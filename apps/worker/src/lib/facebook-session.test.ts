import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertFacebookSessionReady,
  FACEBOOK_SESSION_VERIFICATION_FILE,
  getFacebookBrowserProfileDir,
  getFacebookSessionDiagnostics,
  isFacebookSessionAuthFailureActive,
  markFacebookSessionAuthFailure,
  markFacebookSessionVerified,
  readFacebookSessionVerification,
} from "./facebook-session";

let tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "price-monitor-session-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("getFacebookBrowserProfileDir", () => {
  it("defaults to .facebook-profile under the project root", () => {
    const previous = process.env.FACEBOOK_BROWSER_PROFILE_DIR;
    delete process.env.FACEBOOK_BROWSER_PROFILE_DIR;

    expect(getFacebookBrowserProfileDir()).toContain(".facebook-profile");

    if (previous == null) {
      delete process.env.FACEBOOK_BROWSER_PROFILE_DIR;
    } else {
      process.env.FACEBOOK_BROWSER_PROFILE_DIR = previous;
    }
  });
});

describe("isFacebookSessionAuthFailureActive", () => {
  it("returns true when the latest auth failure is newer than the last verification", () => {
    expect(
      isFacebookSessionAuthFailureActive({
        verifiedAt: "2026-06-17T10:00:00.000Z",
        source: "successful_poll",
        lastFailureAt: "2026-06-17T11:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("returns false when verification is newer than the last auth failure", () => {
    expect(
      isFacebookSessionAuthFailureActive({
        verifiedAt: "2026-06-17T12:00:00.000Z",
        source: "facebook_login",
        lastFailureAt: "2026-06-17T11:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("getFacebookSessionDiagnostics", () => {
  it("reports a confirmed session when the verification marker exists", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    markFacebookSessionVerified("facebook_login", dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("ok");
    expect(diagnostics.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnostics.lastFailureAt).toBeNull();
  });

  it("downgrades to needs_login after a recent Facebook auth failure", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    markFacebookSessionVerified("successful_poll", dir);
    markFacebookSessionAuthFailure(dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("needs_login");
    expect(diagnostics.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnostics.lastFailureAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(diagnostics.message).toContain("recent poll");
  });

  it("reports unverified when the profile directory exists without confirmation", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("unverified");
  });

  it("reports needs_login when the profile directory does not exist yet", () => {
    const dir = join(makeTempDir(), "new-profile");

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("needs_login");
    expect(diagnostics.exists).toBe(false);
  });

  it("reports an unconfigured browser profile", () => {
    const diagnostics = getFacebookSessionDiagnostics(null);

    expect(diagnostics.status).toBe("not_configured");
    expect(diagnostics.path).toBeNull();
  });
});

describe("markFacebookSessionVerified", () => {
  it("writes a verification marker and clears auth failures", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    markFacebookSessionAuthFailure(dir);

    markFacebookSessionVerified("successful_poll", dir);

    const verification = readFacebookSessionVerification(dir);
    expect(verification?.source).toBe("successful_poll");
    expect(verification?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(verification?.lastFailureAt).toBeNull();
    expect(getFacebookSessionDiagnostics(dir).status).toBe("ok");
    expect(readFileSync(join(dir, FACEBOOK_SESSION_VERIFICATION_FILE), "utf8")).toContain(
      "successful_poll",
    );
  });
});

describe("markFacebookSessionAuthFailure", () => {
  it("records the latest auth failure timestamp", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    markFacebookSessionVerified("facebook_login", dir);

    markFacebookSessionAuthFailure(dir);

    const verification = readFacebookSessionVerification(dir);
    expect(verification?.lastFailureAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(getFacebookSessionDiagnostics(dir).status).toBe("needs_login");
  });
});
describe("assertFacebookSessionReady", () => {
  it("blocks polling after a recent Facebook auth failure", () => {
    const previous = process.env.FACEBOOK_BROWSER_PROFILE_DIR;
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    process.env.FACEBOOK_BROWSER_PROFILE_DIR = dir;

    try {
      markFacebookSessionVerified("successful_poll", dir);
      markFacebookSessionAuthFailure(dir);

      expect(() => assertFacebookSessionReady()).toThrow(/Facebook rejected/);
    } finally {
      if (previous == null) {
        delete process.env.FACEBOOK_BROWSER_PROFILE_DIR;
      } else {
        process.env.FACEBOOK_BROWSER_PROFILE_DIR = previous;
      }
    }
  });
});
