import { existsSync } from "node:fs";
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

const PROFILE_IN_USE_MESSAGE =
  "Facebook browser profile is already in use. Close npm run facebook:login and any Chrome/Chromium window using .facebook-profile, then retry. Only one process can open that profile at a time.";

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

function assertProfileNotLocked(profileDir: string): void {
  if (existsSync(join(profileDir, "SingletonLock"))) {
    throw new Error(PROFILE_IN_USE_MESSAGE);
  }
}

function isProfileLockLaunchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("target page, context or browser has been closed") ||
    normalized.includes("existing browser session") ||
    normalized.includes("sessao de navegador existente") ||
    normalized.includes("sessão de navegador existente") ||
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

async function createMarketplaceBrowserContext(): Promise<BrowserContext> {
  const profileDir = getBrowserProfileDir();
  assertProfileNotLocked(profileDir);

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      ...getBrowserContextOptions(),
      headless: isHeadless(),
      args: CHROMIUM_MEMORY_ARGS,
    });
    await configureResourceBlocking(context);
    return context;
  } catch (error) {
    if (isProfileLockLaunchError(error)) {
      throw new Error(PROFILE_IN_USE_MESSAGE, { cause: error });
    }
    throw error;
  }
}

export async function searchMarketplace(input: SearchInput): Promise<NormalizedListing[]> {
  if (isMockMarketplaceEnabled()) {
    return getMockListings(input.keywords);
  }

  assertFacebookSessionReady();

  logMemoryUsage("before poll");

  const context = await createMarketplaceBrowserContext();
  const page = await context.newPage();
  const adapter = new FacebookMarketplaceAdapter();

  try {
    return await adapter.search(page, input);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    logMemoryUsage("after poll");
  }
}

/** Kept for graceful shutdown; browsers are closed after each poll now. */
export async function closeBrowser(): Promise<void> {
  return;
}

export async function withMarketplacePage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
  const context = await createMarketplaceBrowserContext();
  const page = await context.newPage();

  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}