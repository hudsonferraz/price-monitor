export interface ListingPriceStats {
  snapshotCount: number;
  validPriceCount: number;
  lowestSeenCents: number | null;
  recentAverageCents: number | null;
}

export interface DealQualitySignals {
  isLowestSeen: boolean;
  isBelowRecentAverage: boolean;
  lowestSeenCents: number | null;
  recentAverageCents: number | null;
}

const MIN_SNAPSHOTS_FOR_COMPARISON = 2;

export function collectValidPrices(prices: Array<number | null | undefined>): number[] {
  return prices.filter((price): price is number => price != null && price > 0);
}

export function computeListingPriceStats(
  snapshotPricesCents: Array<number | null | undefined>,
): ListingPriceStats {
  const validPrices = collectValidPrices(snapshotPricesCents);

  if (validPrices.length === 0) {
    return {
      snapshotCount: snapshotPricesCents.length,
      validPriceCount: 0,
      lowestSeenCents: null,
      recentAverageCents: null,
    };
  }

  const lowestSeenCents = Math.min(...validPrices);
  const recentAverageCents = Math.round(
    validPrices.reduce((total, price) => total + price, 0) / validPrices.length,
  );

  return {
    snapshotCount: snapshotPricesCents.length,
    validPriceCount: validPrices.length,
    lowestSeenCents,
    recentAverageCents,
  };
}

export function computeDealQualitySignals(input: {
  currentPriceCents: number | null;
  snapshotPricesCents: Array<number | null | undefined>;
}): DealQualitySignals {
  const stats = computeListingPriceStats(input.snapshotPricesCents);
  const hasEnoughHistory = stats.validPriceCount >= MIN_SNAPSHOTS_FOR_COMPARISON;

  const isLowestSeen =
    input.currentPriceCents != null &&
    hasEnoughHistory &&
    stats.lowestSeenCents != null &&
    input.currentPriceCents <= stats.lowestSeenCents;

  const isBelowRecentAverage =
    input.currentPriceCents != null &&
    hasEnoughHistory &&
    stats.recentAverageCents != null &&
    input.currentPriceCents < stats.recentAverageCents;

  return {
    isLowestSeen,
    isBelowRecentAverage,
    lowestSeenCents: stats.lowestSeenCents,
    recentAverageCents: stats.recentAverageCents,
  };
}

export function groupSnapshotPricesByListing(
  snapshots: Array<{
    listingId: string;
    priceCents: number | null;
    savedSearchId: string;
  }>,
): Map<string, Array<number | null>> {
  const grouped = new Map<string, Array<number | null>>();

  for (const snapshot of snapshots) {
    const key = `${snapshot.savedSearchId}:${snapshot.listingId}`;
    const prices = grouped.get(key) ?? [];
    prices.push(snapshot.priceCents);
    grouped.set(key, prices);
  }

  return grouped;
}
