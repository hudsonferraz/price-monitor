import { describe, expect, it } from "vitest";
import {
  countConsecutivePollFailures,
  getFailureBackoffMs,
  isSearchDueForScheduledPoll,
} from "./poll-schedule";

describe("countConsecutivePollFailures", () => {
  it("counts leading failed runs", () => {
    expect(
      countConsecutivePollFailures([
        { status: "FAILED" },
        { status: "FAILED" },
        { status: "SUCCESS" },
      ]),
    ).toBe(2);
  });

  it("returns 0 when the latest run succeeded", () => {
    expect(countConsecutivePollFailures([{ status: "SUCCESS" }, { status: "FAILED" }])).toBe(0);
  });
});

describe("getFailureBackoffMs", () => {
  it("doubles the poll interval for each consecutive failure", () => {
    expect(getFailureBackoffMs(1, 30)).toBe(30 * 60_000);
    expect(getFailureBackoffMs(2, 30)).toBe(60 * 60_000);
    expect(getFailureBackoffMs(3, 30)).toBe(120 * 60_000);
  });
});

describe("isSearchDueForScheduledPoll", () => {
  const now = Date.parse("2026-06-17T12:00:00.000Z");

  it("waits for failure backoff before retrying a failed search", () => {
    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 5 * 60_000),
        lastSuccessfulPollAt: new Date(now - 2 * 60 * 60_000),
        consecutiveFailures: 1,
        now,
      }),
    ).toBe(false);
  });

  it("retries after failure backoff has elapsed", () => {
    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 31 * 60_000),
        lastSuccessfulPollAt: new Date(now - 2 * 60 * 60_000),
        consecutiveFailures: 1,
        now,
      }),
    ).toBe(true);
  });

  it("uses the normal success interval when the latest poll succeeded", () => {
    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 20 * 60_000),
        lastSuccessfulPollAt: new Date(now - 20 * 60_000),
        consecutiveFailures: 0,
        now,
      }),
    ).toBe(false);

    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 35 * 60_000),
        lastSuccessfulPollAt: new Date(now - 35 * 60_000),
        consecutiveFailures: 0,
        now,
      }),
    ).toBe(true);
  });

  it("applies exponential backoff for repeated failures", () => {
    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 45 * 60_000),
        lastSuccessfulPollAt: null,
        consecutiveFailures: 2,
        now,
      }),
    ).toBe(false);

    expect(
      isSearchDueForScheduledPoll({
        pollIntervalMin: 30,
        lastAttemptedAt: new Date(now - 61 * 60_000),
        lastSuccessfulPollAt: null,
        consecutiveFailures: 2,
        now,
      }),
    ).toBe(true);
  });
});
