import { describe, expect, it } from "vitest";
import {
  buildPriceSeries,
  downsamplePriceSeries,
  getSparklineGeometry,
  groupPriceSeries,
  type PricePoint,
  summarizePriceSeries,
} from "./price-history";

function day(n: number): string {
  return new Date(Date.UTC(2026, 9, 1 + n)).toISOString();
}

function series(prices: number[]): PricePoint[] {
  return prices.map((priceCents, index) => ({ priceCents, observedAt: day(index) }));
}

describe("buildPriceSeries", () => {
  it("drops missing prices and orders by observation time", () => {
    expect(
      buildPriceSeries([
        { priceCents: 300, observedAt: day(2) },
        { priceCents: null, observedAt: day(1) },
        { priceCents: 100, observedAt: new Date(day(0)) },
      ]),
    ).toEqual([
      { priceCents: 100, observedAt: day(0) },
      { priceCents: 300, observedAt: day(2) },
    ]);
  });

  it("keeps input order for equal timestamps", () => {
    expect(
      buildPriceSeries([
        { priceCents: 1, observedAt: day(0) },
        { priceCents: 2, observedAt: day(0) },
      ]).map((point) => point.priceCents),
    ).toEqual([1, 2]);
  });
});

describe("groupPriceSeries", () => {
  it("keeps each saved search's observations separate", () => {
    const grouped = groupPriceSeries([
      { savedSearchId: "a", listingId: "l1", priceCents: 200, observedAt: day(1) },
      { savedSearchId: "b", listingId: "l1", priceCents: 999, observedAt: day(0) },
      { savedSearchId: "a", listingId: "l1", priceCents: 100, observedAt: day(0) },
    ]);
    expect(grouped.get("a:l1")?.map((point) => point.priceCents)).toEqual([100, 200]);
    expect(grouped.get("b:l1")?.map((point) => point.priceCents)).toEqual([999]);
  });
});

describe("summarizePriceSeries", () => {
  it("returns null for fewer than two points", () => {
    expect(summarizePriceSeries([])).toBeNull();
    expect(summarizePriceSeries(series([100]))).toBeNull();
  });

  it("summarizes first, latest, extremes, change and direction", () => {
    const summary = summarizePriceSeries(series([2000, 2500, 1500, 1800]));
    expect(summary).toMatchObject({
      count: 4,
      first: { priceCents: 2000, observedAt: day(0) },
      latest: { priceCents: 1800, observedAt: day(3) },
      lowest: { priceCents: 1500, observedAt: day(2) },
      highest: { priceCents: 2500, observedAt: day(1) },
      changeCents: -200,
      changePercent: -10,
      direction: "down",
    });
  });

  it("picks the earliest point on ties and reports flat series", () => {
    const summary = summarizePriceSeries(series([500, 500, 500]));
    expect(summary?.lowest.observedAt).toBe(day(0));
    expect(summary?.highest.observedAt).toBe(day(0));
    expect(summary?.direction).toBe("flat");
    expect(summary?.changePercent).toBe(0);
  });

  it("reports rises and a null percentage when the first price is zero", () => {
    expect(summarizePriceSeries(series([100, 150]))?.direction).toBe("up");
    expect(summarizePriceSeries(series([0, 150]))?.changePercent).toBeNull();
  });
});

describe("downsamplePriceSeries", () => {
  it("returns short series unchanged", () => {
    const points = series([1, 2, 3]);
    expect(downsamplePriceSeries(points, 48)).toBe(points);
  });

  it("returns exactly the limit, in time order, keeping first, last, lowest and highest", () => {
    const prices = Array.from({ length: 1400 }, (_, index) => 100_000 + ((index * 7919) % 5000));
    prices[713] = 1; // lowest, off the even grid
    prices[1021] = 9_999_999; // highest
    const points = series(prices);

    const sampled = downsamplePriceSeries(points, 48);
    expect(sampled).toHaveLength(48);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled.at(-1)).toBe(points.at(-1));
    expect(sampled).toContain(points[713]);
    expect(sampled).toContain(points[1021]);
    const times = sampled.map((point) => Date.parse(point.observedAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("handles a limit just below the series length", () => {
    expect(downsamplePriceSeries(series([5, 1, 9, 3, 7]), 4)).toHaveLength(4);
  });
});

describe("getSparklineGeometry", () => {
  const box = { width: 120, height: 40, padding: 4 };

  it("spans the padded width with the lowest price at the bottom", () => {
    const { coordinates, path } = getSparklineGeometry(series([300, 100, 200]), box);
    expect(coordinates[0]).toEqual({ x: 4, y: 4 });
    expect(coordinates[1]).toEqual({ x: 60, y: 36 });
    expect(coordinates[2]).toEqual({ x: 116, y: 20 });
    expect(path).toBe("M4 4 L60 36 L116 20");
  });

  it("can place points by observation time", () => {
    const points: PricePoint[] = [
      { priceCents: 100, observedAt: day(0) },
      { priceCents: 200, observedAt: day(1) },
      { priceCents: 300, observedAt: day(4) },
    ];
    const xs = getSparklineGeometry(points, box, { xScale: "time" }).coordinates.map((c) => c.x);
    expect(xs).toEqual([4, 32, 116]);
  });

  it("draws a flat series through the middle", () => {
    const { coordinates } = getSparklineGeometry(series([50, 50]), box);
    expect(coordinates.map((coordinate) => coordinate.y)).toEqual([20, 20]);
  });

  it("returns an empty path for no points", () => {
    expect(getSparklineGeometry([], box)).toEqual({ path: "", coordinates: [] });
  });
});
