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

function isHeadless(): boolean {
  return process.env.PLAYWRIGHT_HEADLESS !== "false";
}

function getBrowserProfileDir(): string | undefined {
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
  if (!profileDir) {
    throw new Error("FACEBOOK_BROWSER_PROFILE_DIR must be configured. Run npm run facebook:login first.");
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    ...getBrowserContextOptions(),
    headless: isHeadless(),
    args: CHROMIUM_MEMORY_ARGS,
  });
  await configureResourceBlocking(context);
  return context;
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