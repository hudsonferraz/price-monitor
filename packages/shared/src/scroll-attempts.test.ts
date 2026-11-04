import { describe, expect, it } from "vitest";
import { getScrollAttemptsForLimit, getScrollStopReason, SCROLL_IDLE_LIMIT, type ScrollState } from "./scroll-attempts";

describe("getScrollAttemptsForLimit", () => {
  it("allows more scrolls for bigger listing limits", () => {
    expect(getScrollAttemptsForLimit(12)).toBe(6);
    expect(getScrollAttemptsForLimit(24)).toBe(10);
    expect(getScrollAttemptsForLimit(48)).toBe(16);
  });
});

describe("getScrollStopReason", () => {
  const base: ScrollState = { count: 5, target: 24, idleScrolls: 0, scrolls: 1, maxScrolls: 10, reachedEnd: false };

  it("keeps scrolling while results can still arrive", () => {
    expect(getScrollStopReason(base)).toBeNull();
  });

  it("does not stop after a single quiet scroll", () => {
    expect(getScrollStopReason({ ...base, idleScrolls: 1 })).toBeNull();
    expect(getScrollStopReason({ ...base, idleScrolls: SCROLL_IDLE_LIMIT - 1 })).toBeNull();
  });

  it("stops after several quiet scrolls in a row", () => {
    expect(getScrollStopReason({ ...base, idleScrolls: SCROLL_IDLE_LIMIT })).toBe("idle");
  });

  it("stops when the limit is reached, before anything else", () => {
    expect(getScrollStopReason({ ...base, count: 24, reachedEnd: true })).toBe("limit_reached");
  });

  it("stops as soon as Facebook says there are no more results", () => {
    expect(getScrollStopReason({ ...base, reachedEnd: true })).toBe("end_of_results");
  });

  it("stops at the scroll cap", () => {
    expect(getScrollStopReason({ ...base, scrolls: 10 })).toBe("max_scrolls");
  });
});
