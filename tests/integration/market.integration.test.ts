import type { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { POST as pollSearch } from "@/app/api/searches/[id]/poll/route";
import { POST as createSearch } from "@/app/api/searches/route";
import { prisma } from "@price-monitor/database";
import { isExcludedTitle } from "@price-monitor/shared/exclusions";
import { computeMarketSnapshot, computeSearchMarket, getBelowMarketPercent } from "@price-monitor/shared/market-price";
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

async function poll(searchId: string, previousRuns: number) {
  if (previousRuns > 0) await allowAnotherPoll(searchId);
  const response = await pollSearch(jsonRequest(`/api/searches/${searchId}/poll`, "POST"), routeContext({ id: searchId }));
  expect(response.status).toBe(200);
  return waitForPollToFinish(searchId, previousRuns);
}

describe("market price from stored poll snapshots", () => {
  it("matches an independent calculation from the marketplace results, per poll, with exclusions", async () => {
    const user = await createTestUser("market");
    signInAs(user);
    const created = await createSearch(
      jsonRequest("/api/searches", "POST", {
        name: "Market",
        keywords: "iphone 13",
        listingLimit: 24,
        excludeKeywords: ["capa", "película", "peças", "carregador"],
      }),
    );
    const search = await prisma.savedSearch.findUniqueOrThrow({ where: { id: ((await created.json()) as { id: string }).id } });

    await poll(search.id, 0);
    await poll(search.id, 1);

    const snapshots = await prisma.pollSnapshotListing.findMany({
      where: { pollRun: { savedSearchId: search.id } },
      select: { pollRunId: true, priceCents: true, listing: { select: { title: true } }, pollRun: { select: { startedAt: true } } },
    });
    const market = computeSearchMarket(snapshots, (title) => isExcludedTitle(title, search.excludeKeywords));

    const visiblePrices = (sequence: number) =>
      expectedCatalog(search, sequence)
        .filter((listing) => !isExcludedTitle(listing.title, search.excludeKeywords))
        .map((listing) => listing.priceCents);
    const expectedLatest = computeMarketSnapshot(visiblePrices(1));
    const expectedFirst = computeMarketSnapshot(visiblePrices(0));

    expect(market.snapshot).toEqual(expectedLatest);
    expect(market.trend.map((point) => point.priceCents)).toEqual(
      [expectedFirst, expectedLatest].filter(Boolean).map((snapshot) => snapshot!.marketPriceCents),
    );

    // Every visible listing's badge percentage is reproducible from the stored prices (SC-002).
    const alerts = await prisma.alert.findMany({ where: { savedSearchId: search.id }, include: { listing: true } });
    const latestPrices = new Map(expectedCatalog(search, 1).map((listing) => [listing.externalId, listing.priceCents]));
    for (const alert of alerts) {
      const price = latestPrices.get(alert.listing.externalId);
      if (price === undefined) continue; // Not in the latest poll.
      expect(getBelowMarketPercent(alert.listing.priceCents, market.snapshot)).toBe(
        getBelowMarketPercent(price, expectedLatest),
      );
    }
  });
});
