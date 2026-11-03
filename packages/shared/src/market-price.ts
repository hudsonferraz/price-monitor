/**
 * Typical market price of a saved search, derived from one poll's recorded listing prices.
 * Robust to accessory-priced outliers: a first-pass median sets a plausible band (40%–250%),
 * and the market price is the median of the prices inside it.
 */

export const MIN_LISTINGS_FOR_MARKET = 5;
export const BELOW_MARKET_THRESHOLD_PERCENT = 10;
export const OUTLIER_LOW_RATIO = 0.4;
export const OUTLIER_HIGH_RATIO = 2.5;

export interface MarketSnapshot {
  marketPriceCents: number;
  p25Cents: number;
  p75Cents: number;
  /** Listings the market price is based on (after removing outliers). */
  count: number;
}

export interface MarketTrendPoint {
  priceCents: number;
  observedAt: string;
}

/** Linear-interpolated percentile of an ascending array (0 <= q <= 1). */
function percentile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function computeMarketSnapshot(prices: Array<number | null | undefined>): MarketSnapshot | null {
  const valid = prices
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (valid.length < MIN_LISTINGS_FOR_MARKET) return null;

  const firstPassMedian = percentile(valid, 0.5);
  const kept = valid.filter(
    (price) => price >= firstPassMedian * OUTLIER_LOW_RATIO && price <= firstPassMedian * OUTLIER_HIGH_RATIO,
  );
  if (kept.length < MIN_LISTINGS_FOR_MARKET) return null;

  return {
    marketPriceCents: Math.round(percentile(kept, 0.5)),
    p25Cents: Math.round(percentile(kept, 0.25)),
    p75Cents: Math.round(percentile(kept, 0.75)),
    count: kept.length,
  };
}

/** Whole percent below the market price when it is at least the threshold, otherwise null. */
export function getBelowMarketPercent(
  priceCents: number | null | undefined,
  market: Pick<MarketSnapshot, "marketPriceCents"> | null | undefined,
): number | null {
  if (priceCents == null || priceCents <= 0 || !market || market.marketPriceCents <= 0) return null;
  const percent = ((market.marketPriceCents - priceCents) / market.marketPriceCents) * 100;
  return percent >= BELOW_MARKET_THRESHOLD_PERCENT ? Math.round(percent) : null;
}

/** One market price per poll (skipping polls with too few listings), oldest first. */
export function buildMarketTrend(
  runs: Array<{ observedAt: string | Date; prices: Array<number | null | undefined> }>,
): MarketTrendPoint[] {
  return runs
    .map((run) => ({
      observedAt: typeof run.observedAt === "string" ? new Date(run.observedAt).toISOString() : run.observedAt.toISOString(),
      snapshot: computeMarketSnapshot(run.prices),
    }))
    .filter((entry): entry is { observedAt: string; snapshot: MarketSnapshot } => entry.snapshot != null)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
    .map((entry) => ({ priceCents: entry.snapshot.marketPriceCents, observedAt: entry.observedAt }));
}

export interface SearchMarket {
  /** Market of the latest successful poll in the window, or null without enough listings. */
  snapshot: MarketSnapshot | null;
  /** Start time of the poll the snapshot comes from. */
  observedAt: string | null;
  trend: MarketTrendPoint[];
}

/**
 * Market for one saved search from its recorded poll snapshots (successful polls only record
 * snapshots). Listings whose title matches the search's exclusions are left out.
 */
export function computeSearchMarket(
  snapshots: Array<{
    pollRunId: string;
    priceCents: number | null;
    listing: { title: string };
    pollRun: { startedAt: Date | string };
  }>,
  isExcluded: (title: string) => boolean = () => false,
): SearchMarket {
  const runs = new Map<string, { observedAt: Date; prices: number[] }>();
  for (const snapshot of snapshots) {
    if (snapshot.priceCents == null || isExcluded(snapshot.listing.title)) continue;
    const observedAt = new Date(snapshot.pollRun.startedAt);
    const run = runs.get(snapshot.pollRunId) ?? { observedAt, prices: [] };
    run.prices.push(snapshot.priceCents);
    runs.set(snapshot.pollRunId, run);
  }

  const ordered = [...runs.values()].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
  const latest = ordered.at(-1) ?? null;
  return {
    snapshot: latest ? computeMarketSnapshot(latest.prices) : null,
    observedAt: latest ? latest.observedAt.toISOString() : null,
    trend: buildMarketTrend(ordered),
  };
}
