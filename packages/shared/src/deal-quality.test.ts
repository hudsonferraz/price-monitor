import { describe, expect, it } from "vitest";
import {
  collectValidPrices,
  computeDealQualitySignals,
  computeListingPriceStats,
  DEAL_QUALITY_HISTORY_DAYS,
  getDealQualityHistoryCutoff,
  getPriorSnapshotPrices,
  groupSnapshotPricesByListing,
} from "./deal-quality";

describe("collectValidPrices", () => {
  it("filters null, zero, and negative prices", () => {
    expect(collectValidPrices([100, null, 0, -50, 200])).toEqual([100, 200]);
  });
});

describe("getPriorSnapshotPrices", () => {
  it("drops the newest observation from chronological snapshots", () => {
    expect(getPriorSnapshotPrices([50000, 45000, 40000])).toEqual([50000, 45000]);
  });

  it("returns an empty list when there is only the current observation", () => {
    expect(getPriorSnapshotPrices([40000])).toEqual([]);
  });
});

describe("computeListingPriceStats", () => {
  it("returns null stats when no valid prices exist", () => {
    expect(computeListingPriceStats([null, 0])).toEqual({
      snapshotCount: 2,
      validPriceCount: 0,
      lowestSeenCents: null,
      recentAverageCents: null,
    });
  });

  it("computes lowest and average from valid snapshot prices", () => {
    expect(computeListingPriceStats([50000, 45000, 45000])).toEqual({
      snapshotCount: 3,
      validPriceCount: 3,
      lowestSeenCents: 45000,
      recentAverageCents: 46667,
    });
  });
});

describe("computeDealQualitySignals", () => {
  it("ignores the current snapshot when judging deal quality", () => {
    // Without exclusion, avg of [50000, 40000] would be 45000 and mute sensitivity.
    // With exclusion, prior avg is 50000 so 40000 is clearly below average.
    expect(
      computeDealQualitySignals({
        currentPriceCents: 40000,
        snapshotPricesCents: [50000, 40000],
      }),
    ).toEqual({
      isLowestSeen: false,
      isBelowRecentAverage: false,
      lowestSeenCents: 50000,
      recentAverageCents: 50000,
    });
  });

  it("does not flag deal signals without enough prior history", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 45000,
        snapshotPricesCents: [45000],
      }),
    ).toEqual({
      isLowestSeen: false,
      isBelowRecentAverage: false,
      lowestSeenCents: null,
      recentAverageCents: null,
    });

    expect(
      computeDealQualitySignals({
        currentPriceCents: 40000,
        snapshotPricesCents: [50000, 40000],
      }),
    ).toMatchObject({
      isLowestSeen: false,
      isBelowRecentAverage: false,
    });
  });

  it("flags lowest seen and below average against prior snapshots only", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 40000,
        snapshotPricesCents: [50000, 45000, 40000],
      }),
    ).toEqual({
      isLowestSeen: true,
      isBelowRecentAverage: true,
      lowestSeenCents: 45000,
      recentAverageCents: 47500,
    });
  });

  it("does not flag below average when price is not under the prior average", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 47000,
        snapshotPricesCents: [50000, 45000, 45000, 47000],
      }),
    ).toMatchObject({
      isLowestSeen: false,
      isBelowRecentAverage: false,
      recentAverageCents: 46667,
    });
  });
});

describe("groupSnapshotPricesByListing", () => {
  it("groups prices by saved search and listing", () => {
    const grouped = groupSnapshotPricesByListing([
      { savedSearchId: "search-1", listingId: "listing-a", priceCents: 100 },
      { savedSearchId: "search-1", listingId: "listing-a", priceCents: 90 },
      { savedSearchId: "search-2", listingId: "listing-a", priceCents: 80 },
    ]);

    expect(grouped.get("search-1:listing-a")).toEqual([100, 90]);
    expect(grouped.get("search-2:listing-a")).toEqual([80]);
  });
});

describe("getDealQualityHistoryCutoff", () => {
  it("returns a cutoff DEAL_QUALITY_HISTORY_DAYS ago", () => {
    const now = new Date("2026-07-16T12:00:00.000Z");
    const cutoff = getDealQualityHistoryCutoff(now);

    expect(cutoff.toISOString()).toBe(
      new Date(now.getTime() - DEAL_QUALITY_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    );
  });
});
