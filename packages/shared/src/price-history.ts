/**
 * Price history of a listing within one saved search, built from the prices recorded at each
 * successful poll (PollSnapshotListing joined to PollRun.startedAt). Pure functions only, so the
 * dashboard, the API and the charts share one definition.
 */

export interface PricePoint {
  priceCents: number;
  /** ISO timestamp of the poll that observed this price. */
  observedAt: string;
}

export interface PriceObservation {
  priceCents: number | null;
  observedAt: string | Date;
}

export type PriceDirection = "down" | "up" | "flat";

export interface PriceHistorySummary {
  count: number;
  first: PricePoint;
  latest: PricePoint;
  lowest: PricePoint;
  highest: PricePoint;
  changeCents: number;
  /** Change relative to the first price, or null when the first price is zero. */
  changePercent: number | null;
  direction: PriceDirection;
}

/** Max points sent with each dashboard card; the detail view loads the full series. */
export const PRICE_TREND_MAX_POINTS = 48;

/** A trend is only meaningful with at least two observations. */
export const MIN_POINTS_FOR_TREND = 2;

function toIso(value: string | Date): string {
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}

/** Drops observations without a price and orders the rest by time (stable for equal times). */
export function buildPriceSeries(observations: PriceObservation[]): PricePoint[] {
  return observations
    .filter((observation): observation is { priceCents: number; observedAt: string | Date } =>
      Number.isFinite(observation.priceCents),
    )
    .map((observation) => ({
      priceCents: observation.priceCents,
      observedAt: toIso(observation.observedAt),
    }))
    .map((point, index) => ({ point, index }))
    .sort(
      (a, b) =>
        Date.parse(a.point.observedAt) - Date.parse(b.point.observedAt) || a.index - b.index,
    )
    .map(({ point }) => point);
}

export function getPriceSeriesKey(savedSearchId: string, listingId: string): string {
  return `${savedSearchId}:${listingId}`;
}

/** Groups observations into one ordered series per (saved search, listing). */
export function groupPriceSeries(
  rows: Array<PriceObservation & { savedSearchId: string; listingId: string }>,
): Map<string, PricePoint[]> {
  const grouped = new Map<string, PriceObservation[]>();
  for (const row of rows) {
    const key = getPriceSeriesKey(row.savedSearchId, row.listingId);
    const observations = grouped.get(key) ?? [];
    observations.push({ priceCents: row.priceCents, observedAt: row.observedAt });
    grouped.set(key, observations);
  }

  const series = new Map<string, PricePoint[]>();
  for (const [key, observations] of grouped) {
    series.set(key, buildPriceSeries(observations));
  }
  return series;
}

export function summarizePriceSeries(points: PricePoint[]): PriceHistorySummary | null {
  if (points.length < MIN_POINTS_FOR_TREND) {
    return null;
  }

  const first = points[0];
  const latest = points[points.length - 1];
  let lowest = first;
  let highest = first;
  for (const point of points) {
    // Strict comparisons keep the earliest point on ties.
    if (point.priceCents < lowest.priceCents) lowest = point;
    if (point.priceCents > highest.priceCents) highest = point;
  }

  const changeCents = latest.priceCents - first.priceCents;
  return {
    count: points.length,
    first,
    latest,
    lowest,
    highest,
    changeCents,
    changePercent: first.priceCents === 0 ? null : (changeCents / first.priceCents) * 100,
    direction: changeCents < 0 ? "down" : changeCents > 0 ? "up" : "flat",
  };
}

/**
 * Thins a series to at most `maxPoints`, always keeping the first, last, lowest and highest
 * observations, and filling the rest with evenly spaced points. Order is preserved.
 */
export function downsamplePriceSeries(points: PricePoint[], maxPoints: number): PricePoint[] {
  const limit = Math.max(MIN_POINTS_FOR_TREND, Math.floor(maxPoints));
  if (points.length <= limit) {
    return points;
  }

  let lowestIndex = 0;
  let highestIndex = 0;
  points.forEach((point, index) => {
    if (point.priceCents < points[lowestIndex].priceCents) lowestIndex = index;
    if (point.priceCents > points[highestIndex].priceCents) highestIndex = index;
  });

  const kept = new Set([0, points.length - 1, lowestIndex, highestIndex]);
  const step = (points.length - 1) / (limit - 1);
  for (let slot = 1; kept.size < limit && slot < limit - 1; slot += 1) {
    kept.add(Math.round(slot * step));
  }
  // Rounding can collide with required indexes; top up from the start if still short.
  for (let index = 1; kept.size < limit && index < points.length - 1; index += 1) {
    kept.add(index);
  }

  return [...kept].sort((a, b) => a - b).map((index) => points[index]);
}

export interface ChartBox {
  width: number;
  height: number;
  padding: number;
}

export interface ChartCoordinate {
  x: number;
  y: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Maps a series to SVG coordinates. y is the price, lowest at the bottom; a flat series is drawn
 * through the middle. x is either the position in the series (evenly spaced, for sparklines) or
 * the observation time (for the detail chart, so gaps between polls stay visible).
 */
export function getSparklineGeometry(
  points: PricePoint[],
  box: ChartBox,
  options: { xScale?: "index" | "time" } = {},
): { path: string; coordinates: ChartCoordinate[] } {
  if (points.length === 0) {
    return { path: "", coordinates: [] };
  }

  const innerWidth = Math.max(0, box.width - box.padding * 2);
  const innerHeight = Math.max(0, box.height - box.padding * 2);
  const prices = points.map((point) => point.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const times = points.map((point) => Date.parse(point.observedAt));
  const startTime = times[0];
  const timeSpan = times[times.length - 1] - startTime;
  const useTime = options.xScale === "time" && timeSpan > 0;

  function getXRatio(index: number): number {
    if (points.length === 1) return 0.5;
    return useTime ? (times[index] - startTime) / timeSpan : index / (points.length - 1);
  }

  const coordinates = points.map((point, index) => {
    const x = box.padding + getXRatio(index) * innerWidth;
    const y =
      range === 0
        ? box.padding + innerHeight / 2
        : box.padding + (1 - (point.priceCents - min) / range) * innerHeight;
    return { x: round(x), y: round(y) };
  });

  const path = coordinates
    .map((coordinate, index) => `${index === 0 ? "M" : "L"}${coordinate.x} ${coordinate.y}`)
    .join(" ");

  return { path, coordinates };
}
