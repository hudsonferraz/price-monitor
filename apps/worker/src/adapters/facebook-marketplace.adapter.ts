import type { Page, Response } from "playwright";
import { buildFacebookMarketplaceSearchUrl } from "@price-monitor/shared/facebook-search-url";
import { parseBrazilianPriceToCents } from "@price-monitor/shared/parse-price";
import type { NormalizedListing, SearchInput } from "@price-monitor/shared/types";
import { SOURCE } from "@price-monitor/shared/types";
import { parseListingsFromEmbeddedJson } from "./facebook-embedded-json-parser.ts";
import { parseListingsFromHtml, type RawFacebookListing } from "./facebook-dom-parser.ts";

const DEFAULT_MIN_RESULTS = 5;
const DEFAULT_SCROLL_ATTEMPTS = 4;

export interface FacebookMarketplaceAdapterOptions {
  storageStatePath?: string;
}

export class FacebookMarketplaceAdapter {
  readonly source = SOURCE.FACEBOOK;

  constructor(private readonly options: FacebookMarketplaceAdapterOptions = {}) {}

  async search(page: Page, input: SearchInput): Promise<NormalizedListing[]> {
    const limit = input.limit ?? 24;
    const apiListings: RawFacebookListing[] = [];

    const responseListener = (response: Response) => {
      if (!shouldInspectGraphqlResponse(response.url(), response.request().method())) {
        return;
      }

      response
        .text()
        .then((body) => {
          const parsed = parseFacebookGraphqlPayload(body);
          if (parsed.length > 0) {
            apiListings.push(...parsed);
          }
        })
        .catch(() => undefined);
    };

    page.on("response", responseListener);

    try {
      await navigateToSearchResults(page, input);
      await scrollSearchResults(page, limit);
      await page.waitForTimeout(2_000);

      const html = await page.content();
      const embeddedListings = parseListingsFromEmbeddedJson(html, limit);
      const domListings = embeddedListings.length > 0 ? [] : parseListingsFromHtml(html, limit);
      const merged = dedupeRawListings([...apiListings, ...embeddedListings, ...domListings]).slice(
        0,
        limit,
      );

      return applyPriceFilters(normalizeListings(merged), input);
    } finally {
      page.off("response", responseListener);
    }
  }
}

export async function navigateToSearchResults(page: Page, input: SearchInput): Promise<void> {
  const searchUrl = buildFacebookMarketplaceSearchUrl({
    keywords: input.keywords,
    minPriceCents: input.minPriceCents,
    maxPriceCents: input.maxPriceCents,
  });

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissCookieBanner(page);
  await waitForSearchResults(page, input.limit ?? DEFAULT_MIN_RESULTS);
}

export async function scrollSearchResults(page: Page, targetCount: number): Promise<void> {
  let previousCount = 0;

  for (let attempt = 0; attempt < DEFAULT_SCROLL_ATTEMPTS; attempt += 1) {
    const html = await page.content();
    const currentCount = parseListingsFromEmbeddedJson(html, targetCount).length;

    if (currentCount >= targetCount) {
      return;
    }

    if (currentCount === previousCount && attempt > 0) {
      return;
    }

    previousCount = currentCount;
    await page.mouse.wheel(0, 2_500);
    await page.waitForTimeout(1_500);
  }
}

export async function dismissCookieBanner(page: Page): Promise<void> {
  const allowButton = page
    .getByRole("button", { name: /allow all cookies|permitir todos os cookies|aceitar/i })
    .first();

  if (await allowButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await allowButton.click().catch(() => undefined);
  }
}

export async function waitForSearchResults(page: Page, minimumResults: number): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);

  const currentUrl = page.url();
  if (/login|checkpoint/i.test(currentUrl)) {
    throw new Error(
      "Facebook redirected to login. Export a Playwright storage state after signing in and set FACEBOOK_STORAGE_STATE_PATH.",
    );
  }

  const deadline = Date.now() + 35_000;

  while (Date.now() < deadline) {
    const html = await page.content();
    const listings = parseListingsFromEmbeddedJson(html, minimumResults);

    if (listings.length >= 1) {
      return;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `No Facebook Marketplace listings found. Current URL: ${page.url()}. Try logging in and saving a storage state.`,
  );
}

function normalizeListings(listings: RawFacebookListing[]): NormalizedListing[] {
  return listings.map((listing) => ({
    externalId: listing.externalId,
    title: listing.title,
    priceCents: parseBrazilianPriceToCents(listing.price),
    currency: listing.price.includes("R$") ? "BRL" : "USD",
    url: listing.url,
    imageUrl: listing.imageUrl,
    location: listing.location,
  }));
}

function shouldInspectGraphqlResponse(url: string, method: string): boolean {
  return method === "POST" && url.includes("/api/graphql");
}

function parseFacebookGraphqlPayload(body: string): RawFacebookListing[] {
  const listings: RawFacebookListing[] = [];

  for (const line of body.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    try {
      listings.push(...extractListingsFromGraphqlJson(JSON.parse(line)));
    } catch {
      continue;
    }
  }

  return dedupeRawListings(listings);
}

function extractListingsFromGraphqlJson(payload: unknown, depth = 0): RawFacebookListing[] {
  if (depth > 8 || payload == null) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractListingsFromGraphqlJson(entry, depth + 1));
  }

  if (typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const listings: RawFacebookListing[] = [];

  const listingId = stringifyId(record.id ?? record.listing_id);
  const title = stringifyText(record.marketplace_listing_title ?? record.title ?? record.name);
  const priceObject = record.listing_price ?? record.price;
  const price = stringifyText(priceObject);
  const locationRecord = record.location as
    | { reverse_geocode?: { city?: string; state?: string } }
    | undefined;
  const city = locationRecord?.reverse_geocode?.city;
  const state = locationRecord?.reverse_geocode?.state;
  const location = city && state ? `${city}, ${state}` : stringifyText(record.location);

  if (listingId && title) {
    listings.push({
      externalId: listingId,
      title,
      price,
      url: `https://www.facebook.com/marketplace/item/${listingId}`,
      location: location || undefined,
    });
  }

  for (const value of Object.values(record)) {
    listings.push(...extractListingsFromGraphqlJson(value, depth + 1));
  }

  return dedupeRawListings(listings);
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}

function stringifyText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("formatted_amount" in record) {
      return stringifyText(record.formatted_amount);
    }
    if ("formattedAmount" in record) {
      return stringifyText(record.formattedAmount);
    }
    if ("text" in record) {
      return stringifyText(record.text);
    }
  }

  return "";
}

function dedupeRawListings(listings: RawFacebookListing[]): RawFacebookListing[] {
  const seen = new Set<string>();
  const deduped: RawFacebookListing[] = [];

  for (const listing of listings) {
    if (seen.has(listing.externalId)) {
      continue;
    }

    seen.add(listing.externalId);
    deduped.push(listing);
  }

  return deduped;
}

function applyPriceFilters(listings: NormalizedListing[], input: SearchInput): NormalizedListing[] {
  return listings.filter((listing) => {
    if (listing.priceCents == null) {
      return input.minPriceCents == null && input.maxPriceCents == null;
    }

    if (input.minPriceCents != null && listing.priceCents < input.minPriceCents) {
      return false;
    }

    if (input.maxPriceCents != null && listing.priceCents > input.maxPriceCents) {
      return false;
    }

    return true;
  });
}
