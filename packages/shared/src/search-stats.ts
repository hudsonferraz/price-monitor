export function averagePriceCents(prices: Array<number | null | undefined>): number | null {
  const validPrices = prices.filter((price): price is number => price != null);
  if (validPrices.length === 0) {
    return null;
  }

  const total = validPrices.reduce((sum, price) => sum + price, 0);
  return Math.round(total / validPrices.length);
}

export function minPriceCents(prices: Array<number | null | undefined>): number | null {
  const validPrices = prices.filter((price): price is number => price != null);
  if (validPrices.length === 0) {
    return null;
  }

  return Math.min(...validPrices);
}

export function maxPriceCents(prices: Array<number | null | undefined>): number | null {
  const validPrices = prices.filter((price): price is number => price != null);
  if (validPrices.length === 0) {
    return null;
  }

  return Math.max(...validPrices);
}

export interface SearchStatsTimelinePoint {
  pollRunId: string;
  startedAt: string;
  listingsFound: number;
  averagePriceCents: number | null;
}

export interface SearchStatsSummary {
  savedSearchId: string;
  searchName: string;
  latestAveragePriceCents: number | null;
  lowestPriceCents: number | null;
  highestPriceCents: number | null;
  successfulPollCount: number;
  timeline: SearchStatsTimelinePoint[];
}

export function buildSearchStatsSummary(input: {
  savedSearchId: string;
  searchName: string;
  pollRuns: Array<{
    id: string;
    startedAt: Date;
    listingsFound: number;
    snapshots: Array<{ priceCents: number | null }>;
  }>;
  maxTimelinePoints?: number;
}): SearchStatsSummary | null {
  const { savedSearchId, searchName, pollRuns, maxTimelinePoints = 12 } = input;
  if (pollRuns.length === 0) {
    return null;
  }

  const chronologicalPolls = [...pollRuns].sort(
    (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
  );
  const timelinePolls = chronologicalPolls.slice(-maxTimelinePoints);

  const timeline: SearchStatsTimelinePoint[] = timelinePolls.map((pollRun) => ({
    pollRunId: pollRun.id,
    startedAt: pollRun.startedAt.toISOString(),
    listingsFound: pollRun.listingsFound,
    averagePriceCents: averagePriceCents(pollRun.snapshots.map((snapshot) => snapshot.priceCents)),
  }));

  const latestPoll = chronologicalPolls.at(-1);
  const latestPrices = latestPoll?.snapshots.map((snapshot) => snapshot.priceCents) ?? [];

  return {
    savedSearchId,
    searchName,
    latestAveragePriceCents: averagePriceCents(latestPrices),
    lowestPriceCents: minPriceCents(latestPrices),
    highestPriceCents: maxPriceCents(latestPrices),
    successfulPollCount: pollRuns.length,
    timeline,
  };
}
