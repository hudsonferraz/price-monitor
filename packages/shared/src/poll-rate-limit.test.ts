import { describe, expect, it } from "vitest";
import {
  formatPollCooldownMessage,
  getPollCooldownRemainingMs,
} from "./poll-rate-limit";

describe("getPollCooldownRemainingMs", () => {
  it("returns 0 when search was never polled", () => {
    expect(getPollCooldownRemainingMs(null)).toBe(0);
  });

  it("returns remaining cooldown when polled recently", () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000);
    const remaining = getPollCooldownRemainingMs(twoMinutesAgo);
    expect(remaining).toBeGreaterThan(12 * 60_000);
    expect(remaining).toBeLessThanOrEqual(13 * 60_000);
  });

  it("returns 0 after cooldown elapsed", () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000);
    expect(getPollCooldownRemainingMs(twentyMinutesAgo)).toBe(0);
  });
});

describe("formatPollCooldownMessage", () => {
  it("rounds up to the next minute", () => {
    expect(formatPollCooldownMessage(90_000)).toBe(
      "Please wait 2 minute(s) before polling this search again.",
    );
  });
});
