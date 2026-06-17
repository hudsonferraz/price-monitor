import { describe, expect, it } from "vitest";
import { formatPollQueueMessage } from "./poll-queue-messages";

describe("formatPollQueueMessage", () => {
  it("mentions the blocking search when queued behind another poll", () => {
    const message = formatPollQueueMessage({
      queued: true,
      blockingSearchName: "PlayStation 4",
      waitingPosition: 1,
    });

    expect(message).toContain("PlayStation 4");
    expect(message).toContain("one poll at a time");
  });

  it("includes queue position when waiting behind multiple polls", () => {
    const message = formatPollQueueMessage({
      queued: true,
      blockingSearchName: "TV",
      waitingPosition: 2,
    });

    expect(message).toContain("#2 in line");
  });

  it("returns a running message for an active job on the same search", () => {
    const message = formatPollQueueMessage({
      queued: false,
      jobState: "active",
    });

    expect(message).toContain("already running");
  });
});
