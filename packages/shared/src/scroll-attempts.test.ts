import { describe, expect, it } from "vitest";
import { getScrollAttemptsForLimit } from "./scroll-attempts";

describe("getScrollAttemptsForLimit", () => {
  it("uses fewer scroll attempts for smaller listing limits", () => {
    expect(getScrollAttemptsForLimit(12)).toBe(2);
    expect(getScrollAttemptsForLimit(24)).toBe(3);
    expect(getScrollAttemptsForLimit(48)).toBe(4);
  });
});
