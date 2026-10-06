import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearStaleChromiumProfileLocks,
  isProfileLockLaunchError,
} from "./marketplace-browser";

describe("clearStaleChromiumProfileLocks", () => {
  it("removes Chromium singleton lock files from a profile directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "fb-profile-"));
    writeFileSync(join(dir, "SingletonLock"), "lock");
    writeFileSync(join(dir, "SingletonCookie"), "cookie");
    writeFileSync(join(dir, "keep-me.txt"), "ok");

    const removed = clearStaleChromiumProfileLocks(dir);

    expect(removed.sort()).toEqual(["SingletonCookie", "SingletonLock"]);
    expect(() => clearStaleChromiumProfileLocks(dir)).not.toThrow();

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("isProfileLockLaunchError", () => {
  it("detects Playwright closed-browser and existing-session failures", () => {
    expect(
      isProfileLockLaunchError(
        new Error("browserType.launchPersistentContext: Target page, context or browser has been closed"),
      ),
    ).toBe(true);
    expect(isProfileLockLaunchError(new Error("Abrindo em uma sessao de navegador existente"))).toBe(
      true,
    );
    expect(isProfileLockLaunchError(new Error("Network timeout"))).toBe(false);
  });
});
