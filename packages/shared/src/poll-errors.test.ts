import { describe, expect, it } from "vitest";
import {
  formatDurationMs,
  formatPollErrorForDisplay,
  getPollIssueCode,
  isFacebookSessionError,
  isNoListingsPollError,
} from "./poll-errors";

describe("getPollIssueCode", () => {
  it("classifies login redirect and missing storage state errors", () => {
    expect(
      getPollIssueCode(
        "Facebook redirected to login. Export a Playwright storage state after signing in.",
      ),
    ).toBe("FACEBOOK_SESSION");
    expect(getPollIssueCode("ENOENT: no such file facebook-storage-state.json")).toBe(
      "FACEBOOK_SESSION",
    );
  });

  it("classifies checkpoint errors separately", () => {
    expect(getPollIssueCode("Facebook redirected to checkpoint")).toBe("FACEBOOK_CHECKPOINT");
  });

  it("classifies no-listings and timeout errors", () => {
    expect(getPollIssueCode("No Facebook Marketplace listings found. Current URL: ...")).toBe(
      "NO_LISTINGS",
    );
    expect(getPollIssueCode("Poll timed out before completing.")).toBe("POLL_TIMEOUT");
  });
});

describe("isFacebookSessionError", () => {
  it("detects Facebook session and checkpoint issues", () => {
    expect(isFacebookSessionError("Facebook session expired or login wall detected")).toBe(true);
    expect(isFacebookSessionError("Facebook redirected to checkpoint")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isFacebookSessionError("Poll timed out before completing.")).toBe(false);
  });
});

describe("isNoListingsPollError", () => {
  it("detects no-listings extraction failures", () => {
    expect(isNoListingsPollError("No Facebook Marketplace listings found. Current URL: ...")).toBe(
      true,
    );
  });
});

describe("formatPollErrorForDisplay", () => {
  it("returns a friendly session message", () => {
    expect(formatPollErrorForDisplay("Facebook redirected to login")).toContain("session expired");
  });

  it("returns checkpoint guidance", () => {
    expect(formatPollErrorForDisplay("Facebook redirected to checkpoint")).toContain("checkpoint");
  });

  it("returns no-listings guidance", () => {
    expect(formatPollErrorForDisplay("No Facebook Marketplace listings found")).toContain(
      "could not extract",
    );
  });

  it("returns timeout guidance", () => {
    expect(formatPollErrorForDisplay("Poll timed out before completing.")).toContain("timed out");
  });
});

describe("formatDurationMs", () => {
  it("formats seconds and minutes", () => {
    expect(formatDurationMs(45000)).toBe("45s");
    expect(formatDurationMs(125000)).toBe("2m 5s");
  });
});
