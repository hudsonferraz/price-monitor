import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages/en-US";
import { getPollErrorMessageKey, translatePollError } from "./poll-error-i18n";

const translate = (key: keyof typeof messages) => messages[key];

describe("getPollErrorMessageKey", () => {
  it("maps classified poll errors to message keys", () => {
    expect(getPollErrorMessageKey("Facebook redirected to login.")).toBe("pollErrorSession");
    expect(getPollErrorMessageKey("Facebook redirected to checkpoint")).toBe("pollErrorCheckpoint");
    expect(getPollErrorMessageKey("No Facebook Marketplace listings found")).toBe("pollErrorNoListings");
    expect(getPollErrorMessageKey("Poll timed out before completing.")).toBe("pollErrorTimeout");
    expect(getPollErrorMessageKey("Something else")).toBe("pollErrorUnknown");
  });
});

describe("translatePollError", () => {
  it("returns localized messages for classified errors", () => {
    expect(translatePollError("Facebook redirected to login.", translate)).toBe(messages.pollErrorSession);
    expect(translatePollError("Poll timed out before completing.", translate)).toBe(messages.pollErrorTimeout);
  });

  it("returns the raw message for unclassified errors", () => {
    expect(translatePollError("Database connection failed", translate)).toBe("Database connection failed");
  });

  it("returns the unknown message when no error is provided", () => {
    expect(translatePollError(null, translate)).toBe(messages.pollErrorUnknown);
  });
});
