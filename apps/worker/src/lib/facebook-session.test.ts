import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FACEBOOK_SESSION_VERIFICATION_FILE,
  getFacebookBrowserProfileDir,
  getFacebookSessionDiagnostics,
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

describe("getFacebookSessionDiagnostics", () => {
  it("reports a confirmed session when the verification marker exists", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);
    markFacebookSessionVerified("facebook_login", dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("ok");
    expect(diagnostics.mode).toBe("browser_profile");
    expect(diagnostics.configured).toBe(true);
    expect(diagnostics.path).toBe(dir);
    expect(diagnostics.exists).toBe(true);
  });

  it("reports unverified when the profile directory exists without confirmation", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("unverified");
    expect(diagnostics.mode).toBe("browser_profile");
    expect(diagnostics.configured).toBe(true);
    expect(diagnostics.exists).toBe(true);
  });

  it("reports needs_login when the profile directory does not exist yet", () => {
    const dir = join(makeTempDir(), "new-profile");

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("needs_login");
    expect(diagnostics.mode).toBe("browser_profile");
    expect(diagnostics.configured).toBe(true);
    expect(diagnostics.exists).toBe(false);
  });

  it("reports an unconfigured browser profile", () => {
    const diagnostics = getFacebookSessionDiagnostics(null);

    expect(diagnostics.status).toBe("not_configured");
    expect(diagnostics.mode).toBe("none");
    expect(diagnostics.configured).toBe(false);
    expect(diagnostics.path).toBeNull();
  });
});

describe("markFacebookSessionVerified", () => {
  it("writes a verification marker inside the profile directory", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);

    markFacebookSessionVerified("successful_poll", dir);

    const verification = readFacebookSessionVerification(dir);
    expect(verification?.source).toBe("successful_poll");
    expect(verification?.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readFileSync(join(dir, FACEBOOK_SESSION_VERIFICATION_FILE), "utf8")).toContain(
      "successful_poll",
    );
  });
});
