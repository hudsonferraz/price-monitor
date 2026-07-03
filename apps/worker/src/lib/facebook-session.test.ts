import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getFacebookSessionDiagnostics } from "./facebook-session";

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

describe("getFacebookSessionDiagnostics", () => {
  it("reports a ready persistent browser profile", () => {
    const dir = join(makeTempDir(), "profile");
    mkdirSync(dir);

    const diagnostics = getFacebookSessionDiagnostics(dir);

    expect(diagnostics.status).toBe("ok");
    expect(diagnostics.mode).toBe("browser_profile");
    expect(diagnostics.configured).toBe(true);
    expect(diagnostics.path).toBe(dir);
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
