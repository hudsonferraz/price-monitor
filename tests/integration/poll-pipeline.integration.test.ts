import type { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { POST as pollSearch } from "@/app/api/searches/[id]/poll/route";
import { POST as createSearch } from "@/app/api/searches/route";
import { persistListingsAndAlerts } from "../../apps/worker/src/jobs/poll-search.job";
import { PollRunStatus, prisma } from "@price-monitor/database";
import { MOCK_LISTING_ID_PREFIX } from "@price-monitor/shared/mock-catalog";
import { getPollIssueCode } from "@price-monitor/shared/poll-errors";
import { hasPriceDropped } from "@price-monitor/shared/price-drop";
import {
  allowAnotherPoll,
  closeQueueResources,
  createTestUser,
  expectedCatalog,
  jsonRequest,
  markWorkerOnline,
  routeContext,
  signInAs,
  startPollWorker,
  waitForPollToFinish,
} from "./helpers";

let worker: Worker;

beforeAll(async () => {
  worker = startPollWorker();
  await markWorkerOnline();
});

afterAll(async () => {
  process.env.MOCK_MARKETPLACE_FAILURE_RATE = "0";
  await closeQueueResources(worker);
});

beforeEach(async () => {
  process.env.MOCK_MARKETPLACE_FAILURE_RATE = "0";
  await markWorkerOnline();
});

async function createSearchFor(user: { id: string }, keywords: string, maxPriceReais?: number) {
  signInAs(user);
  const response = await createSearch(
    jsonRequest("/api/searches", "POST", { name: keywords, keywords, maxPriceReais, listingLimit: 24 }),
  );
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  return prisma.savedSearch.findUniqueOrThrow({ where: { id } });
}

async function pollViaApi(savedSearchId: string) {
  const response = await pollSearch(
    jsonRequest(`/api/searches/${savedSearchId}/poll`, "POST"),
    routeContext({ id: savedSearchId }),
  );
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(body.queued).toBe(true);
}

async function countRows(savedSearchId: string) {
  const [alerts, snapshots, listings] = await Promise.all([
    prisma.alert.count({ where: { savedSearchId } }),
    prisma.pollSnapshotListing.count({ where: { pollRun: { savedSearchId } } }),
    prisma.listing.count({ where: { alerts: { some: { savedSearchId } } } }),
  ]);
  return { alerts, snapshots, listings };
}

describe("poll pipeline (API -> queue -> worker -> database)", () => {
  it("records a baseline poll: listings stored, alerts marked as seen, zero new alerts", async () => {
    const user = await createTestUser("baseline");
    const search = await createSearchFor(user, "iphone 13", 3_500);
    const expected = expectedCatalog(search, 0);
    expect(expected.length).toBeGreaterThan(0);

    await pollViaApi(search.id);
    const run = await waitForPollToFinish(search.id, 0);

    expect(run.status).toBe(PollRunStatus.SUCCESS);
    expect(run.listingsFound).toBe(expected.length);
    expect(run.newAlerts).toBe(0);

    const alerts = await prisma.alert.findMany({
      where: { savedSearchId: search.id },
      include: { listing: true },
    });
    expect(alerts.map((alert) => alert.listing.externalId).sort()).toEqual(
      expected.map((listing) => listing.externalId).sort(),
    );
    expect(alerts.every((alert) => alert.seenAt != null && alert.priceDroppedAt == null)).toBe(true);
    expect(alerts.every((alert) => alert.listing.externalId.startsWith(MOCK_LISTING_ID_PREFIX))).toBe(true);

    const updated = await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
    expect(updated.lastSuccessfulPollAt).not.toBeNull();
    expect(updated.consecutiveFailures).toBe(0);
  });

  it("creates new-match and price-drop alerts on the next poll", async () => {
    const user = await createTestUser("second-poll");
    const search = await createSearchFor(user, "bicicleta aro 29");

    await pollViaApi(search.id);
    await waitForPollToFinish(search.id, 0);
    await allowAnotherPoll(search.id);
    await pollViaApi(search.id);
    const run = await waitForPollToFinish(search.id, 1);

    const before = new Map(expectedCatalog(search, 0).map((listing) => [listing.externalId, listing]));
    const after = expectedCatalog(search, 1);
    const expectedNew = after.filter((listing) => !before.has(listing.externalId));
    const expectedDrops = after.filter((listing) => {
      const previous = before.get(listing.externalId);
      return previous != null && hasPriceDropped(previous.priceCents, listing.priceCents);
    });
    // The mock catalog guarantees change on every poll; make sure this test exercises both paths.
    expect(expectedNew.length).toBeGreaterThan(0);
    expect(expectedDrops.length).toBeGreaterThan(0);

    expect(run.status).toBe(PollRunStatus.SUCCESS);
    expect(run.newAlerts).toBe(expectedNew.length + expectedDrops.length);

    const alerts = await prisma.alert.findMany({
      where: { savedSearchId: search.id },
      include: { listing: true },
    });
    const byExternalId = new Map(alerts.map((alert) => [alert.listing.externalId, alert]));

    for (const listing of expectedNew) {
      const alert = byExternalId.get(listing.externalId);
      expect(alert, `new-match alert for ${listing.externalId}`).toBeDefined();
      expect(alert?.seenAt).toBeNull();
      expect(alert?.priceDroppedAt).toBeNull();
    }

    for (const listing of expectedDrops) {
      const alert = byExternalId.get(listing.externalId);
      expect(alert?.priceDroppedAt, `price drop for ${listing.externalId}`).not.toBeNull();
      expect(alert?.previousPriceCents).toBe(before.get(listing.externalId)?.priceCents);
      expect(alert?.listing.priceCents).toBe(listing.priceCents);
    }

    const droppedIds = new Set(expectedDrops.map((listing) => listing.externalId));
    const unexpectedDrops = alerts.filter(
      (alert) => alert.priceDroppedAt != null && !droppedIds.has(alert.listing.externalId),
    );
    expect(unexpectedDrops).toEqual([]);
  });

  it("records a failed poll without touching listings or alerts", async () => {
    const user = await createTestUser("failure");
    const search = await createSearchFor(user, "geladeira frost free");
    await pollViaApi(search.id);
    await waitForPollToFinish(search.id, 0);
    const rowsBefore = await countRows(search.id);

    process.env.MOCK_MARKETPLACE_FAILURE_RATE = "1";
    await allowAnotherPoll(search.id);
    await pollViaApi(search.id);
    const run = await waitForPollToFinish(search.id, 1);

    expect(run.status).toBe(PollRunStatus.FAILED);
    // Stored sanitized, and classified like a real Marketplace timeout.
    expect(getPollIssueCode(run.errorMessage)).toBe("POLL_TIMEOUT");
    expect(await countRows(search.id)).toEqual(rowsBefore);

    const updated = await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });
    expect(updated.consecutiveFailures).toBe(1);
  });

  it("does not duplicate anything when the same poll results are persisted twice", async () => {
    const user = await createTestUser("retry");
    const search = await createSearchFor(user, "notebook dell");
    await pollViaApi(search.id);
    await waitForPollToFinish(search.id, 0);
    await allowAnotherPoll(search.id);
    await pollViaApi(search.id);
    const run = await waitForPollToFinish(search.id, 1);
    const rowsBefore = await countRows(search.id);
    const alertsBefore = await prisma.alert.findMany({
      where: { savedSearchId: search.id },
      select: { id: true, previousPriceCents: true, priceDroppedAt: true },
      orderBy: { id: "asc" },
    });

    // A retry of the same job persists the same listings for the same run again.
    const result = await persistListingsAndAlerts(
      search.id,
      user.id,
      run.id,
      expectedCatalog(search, 1),
      false,
    );

    expect(result.newAlerts).toBe(0);
    expect(await countRows(search.id)).toEqual(rowsBefore);
    const alertsAfter = await prisma.alert.findMany({
      where: { savedSearchId: search.id },
      select: { id: true, previousPriceCents: true, priceDroppedAt: true },
      orderBy: { id: "asc" },
    });
    expect(alertsAfter).toEqual(alertsBefore);
  });
});
