import { describe, expect, it } from "vitest";
import {
  collectValidPrices,
  computeDealQualitySignals,
  computeListingPriceStats,
  groupSnapshotPricesByListing,
} from "./deal-quality";

describe("collectValidPrices", () => {
  it("filters null, zero, and negative prices", () => {
    expect(collectValidPrices([100, null, 0, -50, 200])).toEqual([100, 200]);
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
  it("does not flag deal signals with only one snapshot", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 45000,
        snapshotPricesCents: [45000],
      }),
    ).toEqual({
      isLowestSeen: false,
      isBelowRecentAverage: false,
      lowestSeenCents: 45000,
      recentAverageCents: 45000,
    });
  });

  it("flags lowest seen and below average when price drops over time", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 40000,
        snapshotPricesCents: [50000, 45000, 40000],
      }),
    ).toEqual({
      isLowestSeen: true,
      isBelowRecentAverage: true,
      lowestSeenCents: 40000,
      recentAverageCents: 45000,
    });
  });

  it("does not flag below average when price is not under the average", () => {
    expect(
      computeDealQualitySignals({
        currentPriceCents: 47000,
        snapshotPricesCents: [50000, 45000, 45000],
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
