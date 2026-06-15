import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { FacebookMarketplaceAdapter } from "../adapters/facebook-marketplace.adapter";
import { getMockListings, isMockMarketplaceEnabled } from "./mock-marketplace";
import type { NormalizedListing, SearchInput } from "@price-monitor/shared/types";

let browser: Browser | undefined;
let browserContext: BrowserContext | undefined;

function isHeadless(): boolean {
  return process.env.PLAYWRIGHT_HEADLESS !== "false";
}

function getStorageStatePath(): string | undefined {
  return process.env.FACEBOOK_STORAGE_STATE_PATH || undefined;
}

async function getBrowserContext(): Promise<BrowserContext> {
  if (browserContext) {
    return browserContext;
  }

  browser = await chromium.launch({
    headless: isHeadless(),
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const contextOptions: Parameters<Browser["newContext"]>[0] = {
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  const storageStatePath = getStorageStatePath();
  if (storageStatePath) {
    contextOptions.storageState = storageStatePath;
  }

  browserContext = await browser.newContext(contextOptions);
  return browserContext;
}

export async function searchMarketplace(input: SearchInput): Promise<NormalizedListing[]> {
  if (isMockMarketplaceEnabled()) {
    return getMockListings(input.keywords);
  }

  const context = await getBrowserContext();
  const page = await context.newPage();
  const adapter = new FacebookMarketplaceAdapter({
    storageStatePath: getStorageStatePath(),
  });

  try {
    return await adapter.search(page, input);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  await browserContext?.close();
  await browser?.close();
  browserContext = undefined;
  browser = undefined;
}

export async function withMarketplacePage<T>(
  callback: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await getBrowserContext();
  const page = await context.newPage();

  try {
    return await callback(page);
  } finally {
    await page.close();
  }
}
