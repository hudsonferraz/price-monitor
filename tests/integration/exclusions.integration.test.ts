import type { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { GET as listAlerts } from "@/app/api/alerts/route";
import { POST as pollSearch } from "@/app/api/searches/[id]/poll/route";
import { POST as createSearch, PATCH as updateSearch } from "@/app/api/searches/route";
import { prisma } from "@price-monitor/database";
import { findExcludedTerm, normalizeForMatching } from "@price-monitor/shared/exclusions";
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

beforeAll(() => {
  worker = startPollWorker();
});

afterAll(async () => {
  await closeQueueResources(worker);
});

beforeEach(async () => {
  process.env.MOCK_MARKETPLACE_FAILURE_RATE = "0";
  await markWorkerOnline();
});

async function createSearchFor(user: { id: string }, keywords: string) {
  signInAs(user);
  const response = await createSearch(
    jsonRequest("/api/searches", "POST", { name: keywords, keywords, listingLimit: 24 }),
  );
  expect(response.status).toBe(201);
  return prisma.savedSearch.findUniqueOrThrow({ where: { id: ((await response.json()) as { id: string }).id } });
}

async function poll(searchId: string, previousRuns: number) {
  if (previousRuns > 0) await allowAnotherPoll(searchId);
  const response = await pollSearch(jsonRequest(`/api/searches/${searchId}/poll`, "POST"), routeContext({ id: searchId }));
  expect(response.status).toBe(200);
  return waitForPollToFinish(searchId, previousRuns);
}

function setExclusions(searchId: string, excludeKeywords: string[]) {
  return updateSearch(jsonRequest("/api/searches", "PATCH", { id: searchId, excludeKeywords }));
}

/** A word that appears in some (not all) titles of this search's catalog and not in its keywords. */
function pickExclusionWord(titles: string[], keywords: string): string {
  const keywordWords = new Set(normalizeForMatching(keywords).split(" "));
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const word of new Set(normalizeForMatching(title).split(" "))) {
      if (!keywordWords.has(word) && word.length > 2) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const candidate = [...counts.entries()].find(([, count]) => count > 0 && count < titles.length);
  if (!candidate) throw new Error(`No usable exclusion word in: ${titles.join(" / ")}`);
  return candidate[0];
}

describe("exclude keywords (real API, queue, worker and database)", () => {
  it("keeps excluded listings out of alerts but counts them and keeps their price history", async () => {
    const user = await createTestUser("exclude-poll");
    const search = await createSearchFor(user, "iphone 13");
    const catalog = expectedCatalog(search, 0);
    const word = pickExclusionWord(catalog.map((listing) => listing.title), search.keywords);
    const expectedExcluded = catalog.filter((listing) => findExcludedTerm(listing.title, [word]));

    expect((await setExclusions(search.id, [word.toUpperCase()])).status).toBe(200);
    const run = await poll(search.id, 0);

    expect(run.status).toBe("SUCCESS");
    expect(run.listingsFound).toBe(catalog.length);
    expect(run.excludedCount).toBe(expectedExcluded.length);

    const alerts = await prisma.alert.findMany({ where: { savedSearchId: search.id }, include: { listing: true } });
    expect(alerts).toHaveLength(catalog.length - expectedExcluded.length);
    expect(alerts.every((alert) => !findExcludedTerm(alert.listing.title, [word]))).toBe(true);

    const snapshots = await prisma.pollSnapshotListing.count({ where: { pollRunId: run.id } });
    expect(snapshots).toBe(catalog.length);
  });

  it("hides existing alerts when an exclusion is added and restores them when it is removed", async () => {
    const user = await createTestUser("exclude-toggle");
    const search = await createSearchFor(user, "bicicleta aro 29");
    await poll(search.id, 0);

    const before = (await (await listAlerts(jsonRequest(`/api/alerts?savedSearchId=${search.id}`, "GET"))).json()) as Array<{
      id: string;
      listing: { title: string };
    }>;
    const word = pickExclusionWord(before.map((alert) => alert.listing.title), search.keywords);
    const hidden = before.filter((alert) => findExcludedTerm(alert.listing.title, [word]));
    expect(hidden.length).toBeGreaterThan(0);

    await setExclusions(search.id, [word]);
    const filtered = (await (await listAlerts(jsonRequest(`/api/alerts?savedSearchId=${search.id}`, "GET"))).json()) as Array<{ id: string }>;
    expect(filtered.map((alert) => alert.id).sort()).toEqual(
      before.filter((alert) => !hidden.includes(alert)).map((alert) => alert.id).sort(),
    );

    await setExclusions(search.id, []);
    const restored = (await (await listAlerts(jsonRequest(`/api/alerts?savedSearchId=${search.id}`, "GET"))).json()) as Array<{ id: string }>;
    expect(restored.map((alert) => alert.id).sort()).toEqual(before.map((alert) => alert.id).sort());
  });

  it("rejects exclusions that would hide the search's own keywords", async () => {
    const user = await createTestUser("exclude-conflict");
    signInAs(user);
    const created = await createSearch(
      jsonRequest("/api/searches", "POST", { name: "x", keywords: "iphone 13", excludeKeywords: ["capa", "iPhone"] }),
    );
    expect(created.status).toBe(400);

    const search = await createSearchFor(user, "iphone 13");
    const updated = await setExclusions(search.id, ["13"]);
    expect(updated.status).toBe(400);
    expect((await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } })).excludeKeywords).toEqual([]);
  });
});
