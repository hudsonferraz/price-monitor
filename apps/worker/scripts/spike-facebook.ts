import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContextOptions } from "playwright";
import { parseListingsFromHtml } from "../src/adapters/facebook-dom-parser.ts";
import { FacebookMarketplaceAdapter } from "../src/adapters/facebook-marketplace.adapter.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");
const fixturesDirectory = path.join(projectRoot, "fixtures");
const fixturePath = path.join(fixturesDirectory, "facebook-search-iphone-13.html");
const debugDirectory = path.join(fixturesDirectory, "debug");

const SEARCH_KEYWORDS = "iphone 13";
const LISTING_LIMIT = 5;

async function main(): Promise<void> {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
  const storageStatePath = process.env.FACEBOOK_STORAGE_STATE_PATH;
  const adapter = new FacebookMarketplaceAdapter({ storageStatePath });

  console.log(`Starting Facebook Marketplace spike (headless=${headless})...`);
  console.log(`Query: "${SEARCH_KEYWORDS}"`);
  if (storageStatePath) {
    console.log(`Using storage state: ${storageStatePath}`);
  } else {
    console.log("No FACEBOOK_STORAGE_STATE_PATH set — Facebook may redirect to login.");
  }

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const contextOptions: BrowserContextOptions = {
    locale: "pt-BR",
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  if (storageStatePath) {
    contextOptions.storageState = storageStatePath;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    const listings = await adapter.search(page, {
      keywords: SEARCH_KEYWORDS,
      limit: LISTING_LIMIT,
    });

    await mkdir(fixturesDirectory, { recursive: true });
    const html = await page.content();
    await writeFile(fixturePath, html, "utf8");

    printListings(listings, "live Facebook Marketplace scrape");
    console.log(`Saved HTML fixture: ${path.relative(projectRoot, fixturePath)}`);
    console.log(`\nNote: Facebook may show listings near your account location, not only the selected city.`);
  } catch (error) {
    await mkdir(debugDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const html = await page.content().catch(() => "<!-- unavailable -->");
    const screenshotPath = path.join(debugDirectory, `spike-failure-${timestamp}.png`);
    const htmlPath = path.join(debugDirectory, `spike-failure-${timestamp}.html`);

    await writeFile(htmlPath, html, "utf8").catch(() => undefined);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

    console.error("Live Facebook spike failed:", error instanceof Error ? error.message : error);
    console.error(`Saved debug artifacts under ${path.relative(projectRoot, debugDirectory)}`);

    const partialListings = parseListingsFromHtml(html, LISTING_LIMIT);
    if (partialListings.length > 0) {
      printListings(
        partialListings.map((listing) => ({
          externalId: listing.externalId,
          title: listing.title,
          priceCents: null,
          url: listing.url,
          location: listing.location,
        })),
        "partial page HTML",
      );
    }

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

function printListings(
  listings: Array<{
    externalId: string;
    title: string;
    priceCents: number | null;
    url: string;
    location?: string;
  }>,
  sourceLabel: string,
): void {
  console.log(`\nSource: ${sourceLabel}`);
  console.log(`Found ${listings.length} listing(s):\n`);

  listings.forEach((listing, index) => {
    const price =
      listing.priceCents == null
        ? "Price unavailable"
        : `R$ ${(listing.priceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    console.log(`${index + 1}. ${listing.title}`);
    console.log(`   ID: ${listing.externalId}`);
    console.log(`   Price: ${price}`);
    console.log(`   Location: ${listing.location ?? "Unknown"}`);
    console.log(`   URL: ${listing.url}`);
    console.log("");
  });

  if (listings.length === 0) {
    throw new Error("Spike completed but no listings were extracted.");
  }
}

main().catch((error: unknown) => {
  console.error("Facebook spike failed:", error);
  process.exitCode = 1;
});
