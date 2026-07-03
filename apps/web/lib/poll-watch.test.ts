import { describe, expect, it } from "vitest";
import {
  createPollNowWatchContext,
  createRunningPollWatchContext,
  isTerminalPollRunFromWatch,
} from "./poll-watch";

describe("isTerminalPollRunFromWatch", () => {
  it("ignores the baseline run from before Poll now", () => {
    const context = createPollNowWatchContext("run-old");

    expect(
      isTerminalPollRunFromWatch(
        {
          id: "run-old",
          status: "SUCCESS",
          startedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        context,
      ),
    ).toBe(false);
  });

  it("accepts a new successful run after Poll now", () => {
    const context = createPollNowWatchContext("run-old");

    expect(
      isTerminalPollRunFromWatch(
        {
          id: "run-new",
          status: "SUCCESS",
          startedAt: new Date().toISOString(),
        },
        context,
      ),
    ).toBe(true);
  });

  it("accepts the same run completing after a reload while it was RUNNING", () => {
    const startedAt = new Date(Date.now() - 30_000).toISOString();
    const context = createRunningPollWatchContext(startedAt);

    expect(
      isTerminalPollRunFromWatch(
        {
          id: "run-active",
          status: "SUCCESS",
          startedAt,
        },
        context,
      ),
    ).toBe(true);
  });
});
