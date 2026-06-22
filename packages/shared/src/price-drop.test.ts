import { describe, expect, it } from "vitest";
import { hasPriceDropped } from "./price-drop";

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
