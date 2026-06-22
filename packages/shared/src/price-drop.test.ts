import { describe, expect, it } from "vitest";
import {
  hasPriceDropped,
  isActivePriceDropAlert,
  shouldClearPriceDropEvent,
} from "./price-drop";

describe("hasPriceDropped", () => {
  it("returns true when the next price is lower", () => {
    expect(hasPriceDropped(50_000, 40_000)).toBe(true);
  });

  it("returns false when either price is missing", () => {
    expect(hasPriceDropped(null, 40_000)).toBe(false);
    expect(hasPriceDropped(50_000, null)).toBe(false);
  });

  it("returns false when the price stayed the same or increased", () => {
    expect(hasPriceDropped(50_000, 50_000)).toBe(false);
    expect(hasPriceDropped(50_000, 55_000)).toBe(false);
  });
});

describe("shouldClearPriceDropEvent", () => {
  it("clears when the price rebounds above the recorded pre-drop price", () => {
    expect(
      shouldClearPriceDropEvent({
        recordedPreviousPriceCents: 100_000,
        previousSnapshotPriceCents: 80_000,
        nextPriceCents: 120_000,
      }),
    ).toBe(true);
  });

  it("clears when the price rises above the last snapshot but stays below the pre-drop price", () => {
    expect(
      shouldClearPriceDropEvent({
        recordedPreviousPriceCents: 100_000,
        previousSnapshotPriceCents: 80_000,
        nextPriceCents: 90_000,
      }),
    ).toBe(true);
  });

  it("keeps the drop event while the price stays at the lower level", () => {
    expect(
      shouldClearPriceDropEvent({
        recordedPreviousPriceCents: 100_000,
        previousSnapshotPriceCents: 80_000,
        nextPriceCents: 80_000,
      }),
    ).toBe(false);
  });
});

describe("isActivePriceDropAlert", () => {
  it("returns false when the current price is no longer below the recorded previous price", () => {
    expect(
      isActivePriceDropAlert({
        priceDroppedAt: "2026-06-17T12:00:00.000Z",
        previousPriceCents: 100_000,
        currentPriceCents: 120_000,
      }),
    ).toBe(false);
  });
});
