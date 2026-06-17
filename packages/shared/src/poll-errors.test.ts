import { describe, expect, it } from "vitest";
import {
  formatDurationMs,
  formatPollErrorForDisplay,
  isFacebookSessionError,
} from "./poll-errors";

describe("isFacebookSessionError", () => {
  it("detects login redirect messages", () => {
    expect(
      isFacebookSessionError(
        "Facebook redirected to login. Export a Playwright storage state after signing in.",
      ),
    ).toBe(true);
  });

  it("detects missing storage state file errors", () => {
    expect(isFacebookSessionError("ENOENT: no such file facebook-storage-state.json")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isFacebookSessionError("Poll timed out before completing.")).toBe(false);
  });
});

describe("formatPollErrorForDisplay", () => {
  it("returns a friendly session message", () => {
    expect(formatPollErrorForDisplay("Facebook redirected to login")).toContain("session expired");
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
