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

/** Minimum prior (non-current) snapshots required before deal-quality badges can fire. */
export const MIN_SNAPSHOTS_FOR_COMPARISON = 2;

/** How far back snapshot history is considered for deal-quality averages. */
export const DEAL_QUALITY_HISTORY_DAYS = 30;

export function collectValidPrices(prices: Array<number | null | undefined>): number[] {
  return prices.filter((price): price is number => price != null && price > 0);
}

/**
 * Snapshots must be chronological (oldest → newest). Drops the newest observation
 * so current price is not compared against a baseline that already includes itself.
 */
export function getPriorSnapshotPrices(
  snapshotPricesCents: Array<number | null | undefined>,
): Array<number | null | undefined> {
  if (snapshotPricesCents.length === 0) {
    return [];
  }

  return snapshotPricesCents.slice(0, -1);
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
  /** Chronological snapshot prices (oldest → newest), including the current poll's snapshot. */
  snapshotPricesCents: Array<number | null | undefined>;
}): DealQualitySignals {
  const priorPrices = getPriorSnapshotPrices(input.snapshotPricesCents);
  const stats = computeListingPriceStats(priorPrices);
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

export function getDealQualityHistoryCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - DEAL_QUALITY_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}
