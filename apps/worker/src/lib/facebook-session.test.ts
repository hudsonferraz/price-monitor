import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  it("reports an unconfigured session path", () => {
    const diagnostics = getFacebookSessionDiagnostics(undefined);

    expect(diagnostics.status).toBe("not_configured");
    expect(diagnostics.configured).toBe(false);
  });

  it("reports a missing storage state file", () => {
    const diagnostics = getFacebookSessionDiagnostics(join(makeTempDir(), "missing.json"));

    expect(diagnostics.status).toBe("missing");
    expect(diagnostics.exists).toBe(false);
  });

  it("reports invalid JSON", () => {
    const file = join(makeTempDir(), "facebook-storage-state.json");
    writeFileSync(file, "not-json");

    const diagnostics = getFacebookSessionDiagnostics(file);

    expect(diagnostics.status).toBe("invalid");
    expect(diagnostics.exists).toBe(true);
    expect(diagnostics.validJson).toBe(false);
  });

  it("reports JSON without Facebook cookies", () => {
    const file = join(makeTempDir(), "facebook-storage-state.json");
    writeFileSync(file, JSON.stringify({ cookies: [] }));

    const diagnostics = getFacebookSessionDiagnostics(file);

    expect(diagnostics.status).toBe("invalid");
    expect(diagnostics.validJson).toBe(true);
    expect(diagnostics.facebookCookieCount).toBe(0);
  });

  it("reports incomplete login cookies", () => {
    const file = join(makeTempDir(), "facebook-storage-state.json");
    writeFileSync(
      file,
      JSON.stringify({
        cookies: [{ name: "c_user", domain: ".facebook.com", expires: 4_102_444_800 }],
      }),
    );

    const diagnostics = getFacebookSessionDiagnostics(file, Date.UTC(2026, 0, 1));

    expect(diagnostics.status).toBe("incomplete");
    expect(diagnostics.hasCUserCookie).toBe(true);
    expect(diagnostics.hasXsCookie).toBe(false);
  });

  it("reports usable Facebook login cookies", () => {
    const file = join(makeTempDir(), "facebook-storage-state.json");
    writeFileSync(
      file,
      JSON.stringify({
        cookies: [
          { name: "c_user", domain: ".facebook.com", expires: 4_102_444_800 },
          { name: "xs", domain: ".facebook.com", expires: 4_102_444_800 },
        ],
      }),
    );

    const diagnostics = getFacebookSessionDiagnostics(file, Date.UTC(2026, 0, 1));

    expect(diagnostics.status).toBe("ok");
    expect(diagnostics.facebookCookieCount).toBe(2);
    expect(diagnostics.hasCUserCookie).toBe(true);
    expect(diagnostics.hasXsCookie).toBe(true);
    expect(diagnostics.earliestExpiryIso).toBe("2100-01-01T00:00:00.000Z");
  });
});
