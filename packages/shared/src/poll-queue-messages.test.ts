import { describe, expect, it } from "vitest";
import { formatPollQueueMessage, resolvePollQueueMessage } from "./poll-queue-messages";

describe("resolvePollQueueMessage", () => {
  it("returns a named blocking descriptor when queued behind another poll", () => {
    expect(
      resolvePollQueueMessage({
        queued: true,
        blockingSearchName: "PlayStation 4",
        waitingForAnotherPoll: true,
        waitingPosition: 1,
      }),
    ).toEqual({
      messageCode: "POLL_QUEUE_QUEUED_BEHIND_NAMED",
      searchName: "PlayStation 4",
      waitingPosition: 1,
    });
  });

  it("returns a generic blocking descriptor with queue position", () => {
    expect(
      resolvePollQueueMessage({
        queued: true,
        waitingForAnotherPoll: true,
        waitingPosition: 2,
      }),
    ).toEqual({
      messageCode: "POLL_QUEUE_QUEUED_BEHIND_GENERIC",
      waitingPosition: 2,
    });
  });

  it("returns an active-job descriptor", () => {
    expect(
      resolvePollQueueMessage({
        queued: false,
        jobState: "active",
      }),
    ).toEqual({
      messageCode: "POLL_QUEUE_ALREADY_RUNNING",
    });
  });
});

describe("formatPollQueueMessage", () => {
  it("mentions the blocking search when queued behind another poll", () => {
    const message = formatPollQueueMessage({
      queued: true,
      blockingSearchName: "PlayStation 4",
      waitingForAnotherPoll: true,
      waitingPosition: 1,
    });

    expect(message).toContain("PlayStation 4");
    expect(message).toContain("one poll at a time");
  });

  it("includes queue position when waiting behind multiple polls", () => {
    const message = formatPollQueueMessage({
      queued: true,
      blockingSearchName: "TV",
      waitingForAnotherPoll: true,
      waitingPosition: 2,
    });

    expect(message).toContain("#2 in line");
  });

  it("uses a generic label when blocked by another poll without a name", () => {
    const message = formatPollQueueMessage({
      queued: true,
      waitingForAnotherPoll: true,
      waitingPosition: 2,
    });

    expect(message).toContain("another search");
    expect(message).not.toContain('"');
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
