import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";
import { FacebookMarketplaceAdapter } from "../adapters/facebook-marketplace.adapter";
import { assertFacebookSessionReady, getFacebookBrowserProfileDir } from "./facebook-session";
import { getMockListings, isMockMarketplaceEnabled } from "./mock-marketplace";
import {
  BLOCKED_PLAYWRIGHT_RESOURCE_TYPES,
  CHROMIUM_MEMORY_ARGS,
  logMemoryUsage,
} from "./playwright-memory";
import type { NormalizedListing, SearchInput } from "@price-monitor/shared/types";

export const PROFILE_IN_USE_MESSAGE =
  "Facebook browser profile is already in use. Close npm run facebook:login and any Chrome/Chromium window using .facebook-profile, then retry. Only one process can open that profile at a time.";

const CHROMIUM_PROFILE_LOCK_FILES = ["SingletonLock", "SingletonCookie", "SingletonSocket"] as const;

let sharedContext: BrowserContext | null = null;
let sharedContextLaunch: Promise<BrowserContext> | null = null;

function isHeadless(): boolean {
  return process.env.PLAYWRIGHT_HEADLESS !== "false";
}

function getBrowserProfileDir(): string {
  return getFacebookBrowserProfileDir();
}

function getBrowserContextOptions(): BrowserContextOptions {
  return {
    locale: "pt-BR",
    viewport: { width: 1024, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  };
}

/** Remove lock files left behind when Chromium exited uncleanly (common on Windows). */
export function clearStaleChromiumProfileLocks(profileDir: string): string[] {
  const removed: string[] = [];

  for (const fileName of CHROMIUM_PROFILE_LOCK_FILES) {
    const lockPath = join(profileDir, fileName);
    if (!existsSync(lockPath)) {
      continue;
    }

    unlinkSync(lockPath);
    removed.push(fileName);
  }

  return removed;
}

export function isProfileLockLaunchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("target page, context or browser has been closed") ||
    normalized.includes("existing browser session") ||
    normalized.includes("navegador existente") ||
    normalized.includes("browser profile is already in use") ||
    normalized.includes("browser has been closed")
  );
}

async function configureResourceBlocking(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route) => {
    if (BLOCKED_PLAYWRIGHT_RESOURCE_TYPES.has(route.request().resourceType())) {
      return route.abort();
    }

    return route.continue();
  });
}

async function probeContext(context: BrowserContext): Promise<boolean> {
  try {
    await context.cookies();
    return true;
  } catch {
    return false;
  }
}

async function launchMarketplaceBrowserContext(): Promise<BrowserContext> {
  const profileDir = getBrowserProfileDir();
  const removedLocks = clearStaleChromiumProfileLocks(profileDir);
  if (removedLocks.length > 0) {
    console.warn(
      `[browser] Cleared stale Chromium profile lock(s): ${removedLocks.join(", ")}. Reusing the existing Facebook login in ${profileDir}.`,
    );
  }

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      ...getBrowserContextOptions(),
      headless: isHeadless(),
      args: CHROMIUM_MEMORY_ARGS,
    });
    await configureResourceBlocking(context);
    console.log("[browser] Opened shared Facebook profile browser for this worker process.");
    return context;
  } catch (error) {
    if (isProfileLockLaunchError(error)) {
      throw new Error(PROFILE_IN_USE_MESSAGE, { cause: error });
    }
    throw error;
  }
}

async function getSharedMarketplaceBrowserContext(): Promise<BrowserContext> {
  if (sharedContext && (await probeContext(sharedContext))) {
    return sharedContext;
  }

  sharedContext = null;

  if (!sharedContextLaunch) {
    sharedContextLaunch = launchMarketplaceBrowserContext()
      .then((context) => {
        sharedContext = context;
        context.on("close", () => {
          if (sharedContext === context) {
            sharedContext = null;
          }
        });
        return context;
      })
      .finally(() => {
        sharedContextLaunch = null;
      });
  }

  return sharedContextLaunch;
}

export async function searchMarketplace(input: SearchInput): Promise<NormalizedListing[]> {
  if (isMockMarketplaceEnabled()) {
    return getMockListings(input.keywords);
  }

  assertFacebookSessionReady();

  logMemoryUsage("before poll");

  const context = await getSharedMarketplaceBrowserContext();
  const page = await context.newPage();
  const adapter = new FacebookMarketplaceAdapter();

  try {
    return await adapter.search(page, input);
  } finally {
    await page.close().catch(() => undefined);
    logMemoryUsage("after poll");
  }
}

/** Close the shared browser — only on worker shutdown, not between polls. */
export async function closeBrowser(): Promise<void> {
  const context = sharedContext;
  sharedContext = null;
  sharedContextLaunch = null;

  if (!context) {
    return;
  }

  await context.close().catch(() => undefined);
  console.log("[browser] Closed shared Facebook profile browser.");
}

export async function withMarketplacePage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
  const context = await getSharedMarketplaceBrowserContext();
  const page = await context.newPage();

  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}
