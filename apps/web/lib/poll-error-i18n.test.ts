import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages/en-US";
import { getPollErrorMessageKey, translatePollError } from "./poll-error-i18n";

const translate = (key: keyof typeof messages) => messages[key];

describe("getPollErrorMessageKey", () => {
  it("maps classified poll errors to message keys", () => {
    expect(getPollErrorMessageKey("Facebook redirected to login.")).toBe("pollErrorSession");
    expect(getPollErrorMessageKey("Facebook redirected to checkpoint")).toBe("pollErrorCheckpoint");
    expect(getPollErrorMessageKey("Facebook browser profile is already in use")).toBe(
      "pollErrorBrowserProfileLocked",
    );
    expect(getPollErrorMessageKey("No Facebook Marketplace listings found")).toBe("pollErrorNoListings");
    expect(
      getPollErrorMessageKey(
        "Failed to parse Marketplace listings from a loaded Facebook page. Current URL: ...",
      ),
    ).toBe("pollErrorParseEmpty");
    expect(getPollErrorMessageKey("Poll timed out before completing.")).toBe("pollErrorTimeout");
    expect(getPollErrorMessageKey("Something else")).toBe("pollErrorUnknown");
  });
});

describe("translatePollError", () => {
  it("returns localized messages for classified errors", () => {
    expect(translatePollError("Facebook redirected to login.", translate)).toBe(messages.pollErrorSession);
    expect(translatePollError("Poll timed out before completing.", translate)).toBe(messages.pollErrorTimeout);
  });

  it("maps polluted Playwright dumps to the profile-locked message", () => {
    const dump =
      "browserType.launchPersistentContext: Target page, context or browser has been closed\nBrowser logs:\n--disable-gpu";
    expect(translatePollError(dump, translate)).toBe(messages.pollErrorBrowserProfileLocked);
  });

  it("returns a short sanitized message for unclassified errors", () => {
    expect(translatePollError("Database connection failed", translate)).toBe("Database connection failed");
  });

  it("returns the unknown message when no error is provided", () => {
    expect(translatePollError(null, translate)).toBe(messages.pollErrorUnknown);
  });
});
