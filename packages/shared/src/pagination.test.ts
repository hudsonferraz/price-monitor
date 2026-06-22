import { describe, expect, it } from "vitest";
import { parsePaginationLimit } from "./pagination";

const options = { defaultLimit: 50, maxLimit: 100 };

describe("parsePaginationLimit", () => {
  it("returns the default when limit is missing", () => {
    expect(parsePaginationLimit(null, options)).toBe(50);
  });

  it("clamps values above the maximum", () => {
    expect(parsePaginationLimit("500", options)).toBe(100);
  });

  it("returns the default for invalid, zero, or negative values", () => {
    expect(parsePaginationLimit("abc", options)).toBe(50);
    expect(parsePaginationLimit("0", options)).toBe(50);
    expect(parsePaginationLimit("-5", options)).toBe(50);
  });

  it("accepts valid positive integers", () => {
    expect(parsePaginationLimit("25", options)).toBe(25);
  });
});
