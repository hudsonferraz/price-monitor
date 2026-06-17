import { describe, expect, it } from "vitest";
import {
  averagePriceCents,
  buildSearchStatsSummary,
  maxPriceCents,
  minPriceCents,
} from "./search-stats";

describe("search stats helpers", () => {
  it("computes average, min, and max prices", () => {
    expect(averagePriceCents([10000, 20000, null])).toBe(15000);
    expect(minPriceCents([10000, 20000, null])).toBe(10000);
    expect(maxPriceCents([10000, 20000, null])).toBe(20000);
  });

  it("builds a timeline from successful poll runs", () => {
    const summary = buildSearchStatsSummary({
      savedSearchId: "search-1",
      searchName: "Bikes",
      pollRuns: [
        {
          id: "run-1",
          startedAt: new Date("2026-06-01T10:00:00.000Z"),
          listingsFound: 2,
          snapshots: [{ priceCents: 10000 }, { priceCents: 30000 }],
        },
        {
          id: "run-2",
          startedAt: new Date("2026-06-02T10:00:00.000Z"),
          listingsFound: 3,
          snapshots: [{ priceCents: 12000 }, { priceCents: 18000 }, { priceCents: 24000 }],
        },
      ],
    });

    expect(summary?.latestAveragePriceCents).toBe(18000);
    expect(summary?.timeline).toHaveLength(2);
    expect(summary?.timeline[1]?.listingsFound).toBe(3);
  });
});
