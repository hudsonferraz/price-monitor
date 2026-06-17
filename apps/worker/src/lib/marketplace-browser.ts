import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { FacebookMarketplaceAdapter } from "../adapters/facebook-marketplace.adapter";
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

function getStorageStatePath(): string | undefined {
  return process.env.FACEBOOK_STORAGE_STATE_PATH || undefined;
}

async function configureResourceBlocking(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route) => {
    if (BLOCKED_PLAYWRIGHT_RESOURCE_TYPES.has(route.request().resourceType())) {
      return route.abort();
    }

    return route.continue();
  });
}

async function createEphemeralBrowserContext(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const browser = await chromium.launch({
    headless: isHeadless(),
    args: CHROMIUM_MEMORY_ARGS,
  });

  const contextOptions: Parameters<Browser["newContext"]>[0] = {
    locale: "pt-BR",
    viewport: { width: 1024, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  };

  const storageStatePath = getStorageStatePath();
  if (storageStatePath) {
    contextOptions.storageState = storageStatePath;
  }

  const context = await browser.newContext(contextOptions);
  await configureResourceBlocking(context);

  return { browser, context };
}

export async function searchMarketplace(input: SearchInput): Promise<NormalizedListing[]> {
  if (isMockMarketplaceEnabled()) {
    return getMockListings(input.keywords);
  }

  logMemoryUsage("before poll");

  const { browser, context } = await createEphemeralBrowserContext();
  const page = await context.newPage();
  const adapter = new FacebookMarketplaceAdapter({
    storageStatePath: getStorageStatePath(),
  });

  try {
    return await adapter.search(page, input);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    logMemoryUsage("after poll");
  }
}

/** Kept for graceful shutdown; browsers are closed after each poll now. */
export async function closeBrowser(): Promise<void> {
  return;
}

export async function withMarketplacePage<T>(
  callback: (page: Page) => Promise<T>,
): Promise<T> {
  const { browser, context } = await createEphemeralBrowserContext();
  const page = await context.newPage();

  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
