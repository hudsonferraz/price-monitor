import { describe, expect, it } from "vitest";
import {
  formatDurationMs,
  formatPollErrorForDisplay,
  getPollIssueCode,
  isFacebookSessionError,
  isNoListingsPollError,
  sanitizePollErrorMessage,
} from "./poll-errors";

describe("getPollIssueCode", () => {
  it("classifies locked browser profile errors", () => {
    expect(
      getPollIssueCode(
        "Facebook browser profile is already in use. Close other Chrome windows using .facebook-profile.",
      ),
    ).toBe("BROWSER_PROFILE_LOCKED");
    expect(getPollIssueCode("Abrindo em uma sessao de navegador existente.")).toBe(
      "BROWSER_PROFILE_LOCKED",
    );
  });

  it("classifies polluted Playwright launch dumps as profile locked", () => {
    const dump = [
      "browserType.launchPersistentContext: Target page, context or browser has been closed",
      "Browser logs:",
      "<launching> C:\\Users\\T-GAMER\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe --disable-gpu --user-data-dir=.facebook-profile",
      "[pid=10724][out] Abrindo em uma sess�o de navegador existente.",
    ].join("\n");

    expect(getPollIssueCode(dump)).toBe("BROWSER_PROFILE_LOCKED");
  });

  it("classifies login redirect errors", () => {
    expect(getPollIssueCode("Facebook redirected to login.")).toBe("FACEBOOK_SESSION");
  });

  it("classifies checkpoint errors separately", () => {
    expect(getPollIssueCode("Facebook redirected to checkpoint")).toBe("FACEBOOK_CHECKPOINT");
  });

  it("classifies parse-empty separately from no-listings", () => {
    expect(
      getPollIssueCode(
        "Failed to parse Marketplace listings from a loaded Facebook page. Current URL: https://www.facebook.com/marketplace/search?query=x",
      ),
    ).toBe("PARSE_EMPTY");
    expect(getPollIssueCode("No Facebook Marketplace listings found. Current URL: ...")).toBe(
      "NO_LISTINGS",
    );
  });

  it("classifies timeout errors", () => {
    expect(getPollIssueCode("Poll timed out before completing.")).toBe("POLL_TIMEOUT");
  });

  it("does not classify unrelated session wording as a Facebook session error", () => {
    expect(getPollIssueCode("Failed to restore browser session storage")).toBe("UNKNOWN");
  });
});

describe("sanitizePollErrorMessage", () => {
  it("collapses Playwright dumps into a short profile-locked message", () => {
    const dump = [
      "browserType.launchPersistentContext: Target page, context or browser has been closed",
      "Browser logs:",
      "<launching> chrome.exe --disable-gpu --user-data-dir=.facebook-profile",
    ].join("\n");

    const sanitized = sanitizePollErrorMessage(dump);
    expect(sanitized).toContain("browser profile is already in use");
    expect(sanitized).not.toContain("Browser logs");
    expect(sanitized).not.toContain("--disable-gpu");
    expect(sanitized.length).toBeLessThan(200);
  });

  it("keeps short unknown errors readable", () => {
    expect(sanitizePollErrorMessage("Database connection failed")).toBe("Database connection failed");
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
  it("returns profile-locked guidance", () => {
    expect(
      formatPollErrorForDisplay("Facebook browser profile is already in use"),
    ).toContain("already open");
  });

  it("returns friendly copy for polluted Playwright dumps", () => {
    const dump =
      "browserType.launchPersistentContext: Target page, context or browser has been closed\nBrowser logs:\n--disable-gpu";
    expect(formatPollErrorForDisplay(dump)).toContain("already open");
    expect(formatPollErrorForDisplay(dump)).not.toContain("--disable-gpu");
  });

  it("returns checkpoint guidance", () => {
    expect(formatPollErrorForDisplay("Facebook redirected to checkpoint")).toContain("checkpoint");
  });

  it("returns parse-empty guidance", () => {
    expect(
      formatPollErrorForDisplay(
        "Failed to parse Marketplace listings from a loaded Facebook page. Current URL: ...",
      ),
    ).toContain("could not parse");
  });

  it("returns no-listings guidance", () => {
    expect(formatPollErrorForDisplay("No Facebook Marketplace listings found")).toContain(
      "no Marketplace listings matched",
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
