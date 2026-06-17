import { describe, expect, it } from "vitest";
import { sortAlerts } from "./sort-alerts";

describe("sortAlerts", () => {
  const alerts = [
    {
      id: "1",
      createdAt: "2026-01-01T00:00:00.000Z",
      listing: { priceCents: 300_00 },
    },
    {
      id: "2",
      createdAt: "2026-01-03T00:00:00.000Z",
      listing: { priceCents: 100_00 },
    },
    {
      id: "3",
      createdAt: "2026-01-02T00:00:00.000Z",
      listing: { priceCents: null },
    },
  ];

  it("sorts by newest date first", () => {
    const sorted = sortAlerts(alerts, "date-desc");
    expect(sorted.map((alert) => alert.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts by lowest price first", () => {
    const sorted = sortAlerts(alerts, "price-asc");
    expect(sorted.map((alert) => alert.id)).toEqual(["2", "1", "3"]);
  });
});
