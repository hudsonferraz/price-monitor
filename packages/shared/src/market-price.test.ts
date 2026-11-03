import { describe, expect, it } from "vitest";
import { buildMarketTrend, computeMarketSnapshot, computeSearchMarket, getBelowMarketPercent } from "./market-price";

const reais = (values: number[]) => values.map((value) => value * 100);

describe("computeMarketSnapshot", () => {
  it("needs at least 5 priced listings", () => {
    expect(computeMarketSnapshot(reais([100, 200, 300, 400]))).toBeNull();
    expect(computeMarketSnapshot([...reais([100, 200, 300, 400]), null, undefined])).toBeNull();
  });

  it("returns the median, quartiles and count", () => {
    expect(computeMarketSnapshot(reais([2000, 2500, 3000, 3500, 4000]))).toEqual({
      marketPriceCents: 300_000,
      p25Cents: 250_000,
      p75Cents: 350_000,
      count: 5,
    });
  });

  it("is not dragged down by accessory-priced outliers (SC-001)", () => {
    const phones = reais([1500, 1650, 1700, 1800, 1850, 1900, 2000, 2100, 2200, 2400]);
    const withCases = [...phones, ...reais([30, 35, 45, 60, 80])];
    const clean = computeMarketSnapshot(phones)!;
    const noisy = computeMarketSnapshot(withCases)!;

    expect(noisy.count).toBe(phones.length);
    expect(Math.abs(noisy.marketPriceCents - clean.marketPriceCents) / clean.marketPriceCents).toBeLessThan(0.05);
  });

  it("drops absurdly high outliers too", () => {
    const snapshot = computeMarketSnapshot(reais([1000, 1100, 1200, 1300, 1400, 99_999]))!;
    expect(snapshot.count).toBe(5);
    expect(snapshot.marketPriceCents).toBe(120_000);
  });

  it("handles identical prices", () => {
    expect(computeMarketSnapshot(reais([500, 500, 500, 500, 500]))).toMatchObject({
      marketPriceCents: 50_000,
      p25Cents: 50_000,
      p75Cents: 50_000,
    });
  });
});

describe("getBelowMarketPercent", () => {
  const market = { marketPriceCents: 200_000 };

  it("returns the rounded percent at or past 10% below", () => {
    expect(getBelowMarketPercent(180_000, market)).toBe(10);
    expect(getBelowMarketPercent(154_000, market)).toBe(23);
  });

  it("returns null for ordinary or higher prices and missing data", () => {
    expect(getBelowMarketPercent(181_000, market)).toBeNull();
    expect(getBelowMarketPercent(250_000, market)).toBeNull();
    expect(getBelowMarketPercent(null, market)).toBeNull();
    expect(getBelowMarketPercent(100_000, null)).toBeNull();
  });
});

describe("buildMarketTrend", () => {
  it("orders points and skips polls without enough listings", () => {
    const trend = buildMarketTrend([
      { observedAt: "2026-11-02T10:00:00Z", prices: reais([900, 1000, 1100, 1200, 1300]) },
      { observedAt: "2026-11-01T10:00:00Z", prices: reais([1000, 1100, 1200, 1300, 1400]) },
      { observedAt: "2026-11-03T10:00:00Z", prices: reais([1, 2]) },
    ]);
    expect(trend).toEqual([
      { priceCents: 120_000, observedAt: "2026-11-01T10:00:00.000Z" },
      { priceCents: 110_000, observedAt: "2026-11-02T10:00:00.000Z" },
    ]);
  });
});

describe("computeSearchMarket", () => {
  const row = (pollRunId: string, startedAt: string, priceCents: number | null, title = "iPhone 13") => ({
    pollRunId,
    priceCents,
    listing: { title },
    pollRun: { startedAt },
  });

  it("uses the latest poll, skips excluded titles and builds the trend", () => {
    const older = [1000, 1100, 1200, 1300, 1400].map((value) => row("r1", "2026-11-01T10:00:00Z", value * 100));
    const latest = [
      ...[900, 1000, 1100, 1200, 1300].map((value) => row("r2", "2026-11-02T10:00:00Z", value * 100)),
      row("r2", "2026-11-02T10:00:00Z", 5_000, "Capa iPhone 13"),
      row("r2", "2026-11-02T10:00:00Z", null),
    ];
    const market = computeSearchMarket([...latest, ...older], (title) => title.startsWith("Capa"));

    expect(market.snapshot).toMatchObject({ marketPriceCents: 110_000, count: 5 });
    expect(market.observedAt).toBe("2026-11-02T10:00:00.000Z");
    expect(market.trend.map((point) => point.priceCents)).toEqual([120_000, 110_000]);
  });

  it("returns an empty market without snapshots", () => {
    expect(computeSearchMarket([])).toEqual({ snapshot: null, observedAt: null, trend: [] });
  });
});
