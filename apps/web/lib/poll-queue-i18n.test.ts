import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages/en-US";
import { translatePollQueueMessage } from "./poll-queue-i18n";

const translate = (key: keyof typeof messages, params?: Record<string, string | number>) => {
  const template = messages[key];
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [name, value]) => result.replace(`{${name}}`, String(value)),
    template,
  );
};

describe("translatePollQueueMessage", () => {
  it("translates a simple queued message", () => {
    expect(
      translatePollQueueMessage({ messageCode: "POLL_QUEUE_QUEUED" }, translate),
    ).toContain("Poll queued");
  });

  it("translates a named blocking message with queue position", () => {
    const message = translatePollQueueMessage(
      {
        messageCode: "POLL_QUEUE_QUEUED_BEHIND_NAMED",
        searchName: "PlayStation 4",
        waitingPosition: 2,
      },
      translate,
    );

    expect(message).toContain("PlayStation 4");
    expect(message).toContain("#2 in line");
  });

  it("falls back to the default queued message when code is missing", () => {
    expect(translatePollQueueMessage(null, translate)).toBe(messages.pollStatusQueuedAuto);
  });
});
