import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveFailureSnapshot, type SnapshotPage } from "./failure-snapshot";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "poll-snapshots-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function fakePage(overrides: Partial<SnapshotPage> = {}): SnapshotPage {
  return {
    url: () => "https://www.facebook.com/privacy/consent/marketplace/",
    title: async () => "Consent",
    content: async () => "<html><body>consent</body></html>",
    screenshot: async ({ path: file }) => writeFile(file, "png"),
    ...overrides,
  };
}

describe("saveFailureSnapshot", () => {
  it("writes the screenshot, HTML and a text summary", async () => {
    const folder = await saveFailureSnapshot(fakePage(), "FACEBOOK_CHECKPOINT", new Error("Facebook redirected to checkpoint"), {
      dir,
      now: new Date("2026-11-04T12:00:00Z"),
    });

    expect(folder).not.toBeNull();
    expect(path.basename(folder!)).toBe("2026-11-04_12-00-00-000_facebook-checkpoint");
    expect(await readFile(path.join(folder!, "page.html"), "utf8")).toContain("consent");
    expect(existsSync(path.join(folder!, "page.png"))).toBe(true);
    const summary = await readFile(path.join(folder!, "page.txt"), "utf8");
    expect(summary).toContain("URL: https://www.facebook.com/privacy/consent/marketplace/");
    expect(summary).toContain("Error: Facebook redirected to checkpoint");
  });

  it("keeps only the newest snapshots", async () => {
    for (let index = 0; index < 5; index += 1) {
      await saveFailureSnapshot(fakePage(), "unknown", "boom", { dir, keep: 3, now: new Date(Date.UTC(2026, 10, 4, 12, index)) });
    }
    const folders = (await readdir(dir)).sort();
    expect(folders).toHaveLength(3);
    expect(folders[0]).toMatch(/^2026-11-04_12-02/);
  });

  it("still saves what it can when the page is gone, and never throws", async () => {
    const broken = fakePage({
      url: () => {
        throw new Error("page closed");
      },
      title: async () => {
        throw new Error("page closed");
      },
      content: async () => {
        throw new Error("page closed");
      },
      screenshot: async () => {
        throw new Error("page closed");
      },
    });
    const folder = await saveFailureSnapshot(broken, "poll timeout", new Error("timeout"), { dir });
    expect(await readFile(path.join(folder!, "page.txt"), "utf8")).toContain("URL: (unknown)");

    const unwritable = path.join(dir, "file-not-dir");
    await writeFile(unwritable, "x");
    await expect(saveFailureSnapshot(fakePage(), "x", "y", { dir: unwritable })).resolves.toBeNull();
  });
});
