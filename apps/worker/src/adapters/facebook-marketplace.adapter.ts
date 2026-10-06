import type { Page, Response } from "playwright";
import { buildFacebookMarketplaceSearchUrl } from "@price-monitor/shared/facebook-search-url";
import { parseBrazilianPriceToCents } from "@price-monitor/shared/parse-price";
import type { NormalizedListing, SearchInput } from "@price-monitor/shared/types";
import { SOURCE } from "@price-monitor/shared/types";
import {
  getScrollAttemptsForLimit,
  MAX_GRAPHQL_RESPONSE_BYTES,
} from "@price-monitor/shared/scroll-attempts";
import { parseListingsFromEmbeddedJson } from "./facebook-embedded-json-parser";
import { parseListingsFromHtml, type RawFacebookListing } from "./facebook-dom-parser";

const DEFAULT_MIN_RESULTS = 5;

const FACEBOOK_LOGIN_WALL_PATTERNS = [
  /log in to facebook/i,
  /entrar no facebook/i,
  /login_form/i,
  /checkpoint/i,
  /you must log in/i,
  /voce precisa entrar/i,
  /voc\u00ea precisa entrar/i,
];

export function hasFacebookLoginWall(html: string): boolean {
  return FACEBOOK_LOGIN_WALL_PATTERNS.some((pattern) => pattern.test(html));
}


export class FacebookMarketplaceAdapter {
  readonly source = SOURCE.FACEBOOK;

  async search(page: Page, input: SearchInput): Promise<NormalizedListing[]> {
    const limit = input.limit ?? 24;
    const apiListings: RawFacebookListing[] = [];
    const maxApiListings = limit * 2;
    const pendingResponses: Promise<void>[] = [];

    const responseListener = (response: Response) => {
      if (!shouldInspectGraphqlResponse(response.url(), response.request().method())) {
        return;
      }

      if (apiListings.length >= maxApiListings) {
        return;
      }

      pendingResponses.push(
        response
          .text()
          .then((body) => {
            if (body.length > MAX_GRAPHQL_RESPONSE_BYTES) {
              return;
            }

            const parsed = parseFacebookGraphqlPayload(body);
            if (parsed.length > 0) {
              apiListings.push(...parsed.slice(0, maxApiListings - apiListings.length));
            }
          })
          .catch(() => undefined),
      );
    };

    page.on("response", responseListener);

    try {
      await navigateToSearchResults(page, input, apiListings);
      await scrollSearchResults(page, limit, apiListings);
      await page.waitForTimeout(1_000);
      await Promise.allSettled(pendingResponses);

      const html = await page.content();
      const merged = collectAvailableListings(html, limit, apiListings).slice(0, limit);

      return applyPriceFilters(normalizeListings(merged), input);
    } finally {
      page.off("response", responseListener);
    }
  }
}

export async function navigateToSearchResults(
  page: Page,
  input: SearchInput,
  capturedApiListings: RawFacebookListing[] = [],
): Promise<void> {
  const searchUrl = buildFacebookMarketplaceSearchUrl({
    keywords: input.keywords,
    minPriceCents: input.minPriceCents,
    maxPriceCents: input.maxPriceCents,
  });

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissCookieBanner(page);
  await waitForSearchResults(page, input.limit ?? DEFAULT_MIN_RESULTS, capturedApiListings);
}

export async function scrollSearchResults(
  page: Page,
  targetCount: number,
  capturedApiListings: RawFacebookListing[] = [],
): Promise<void> {
  let previousCount = 0;
  const scrollAttempts = getScrollAttemptsForLimit(targetCount);

  for (let attempt = 0; attempt < scrollAttempts; attempt += 1) {
    const html = await page.content();
    const currentCount = collectAvailableListings(html, targetCount, capturedApiListings).length;

    if (currentCount >= targetCount) {
      return;
    }

    if (currentCount === previousCount && attempt > 0) {
      return;
    }

    previousCount = currentCount;
    await page.mouse.wheel(0, 1_800);
    await page.waitForTimeout(1_000);
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

export function collectAvailableListings(
  html: string,
  limit: number,
  capturedApiListings: RawFacebookListing[] = [],
): RawFacebookListing[] {
  const embeddedListings = parseListingsFromEmbeddedJson(html, limit);
  const domListings = parseListingsFromHtml(html, limit);
  return dedupeRawListings([...capturedApiListings, ...embeddedListings, ...domListings]);
}

export function looksLikeMarketplaceSearchPage(html: string, url: string): boolean {
  if (!/facebook\.com\/marketplace/i.test(url)) {
    return false;
  }

  return /marketplace/i.test(html) && !hasFacebookLoginWall(html);
}

export async function waitForSearchResults(
  page: Page,
  minimumResults: number,
  capturedApiListings: RawFacebookListing[] = [],
): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 25_000 }).catch(() => undefined);

  const currentUrl = page.url();
  if (/login|checkpoint/i.test(currentUrl)) {
    throw new Error(
      "Facebook redirected to login. Run npm run facebook:login and fix the local Facebook browser profile.",
    );
  }

  const deadline = Date.now() + 50_000;

  while (Date.now() < deadline) {
    const html = await page.content();
    const listings = collectAvailableListings(html, minimumResults, capturedApiListings);

    if (listings.length >= 1) {
      return;
    }

    if (hasFacebookLoginWall(html)) {
      throw new Error(
        "Facebook session expired or login wall detected. Run npm run facebook:login and fix the local Facebook browser profile.",
      );
    }

    await page.waitForTimeout(1_000);
  }

  const finalHtml = await page.content().catch(() => "");
  const finalUrl = page.url();
  if (looksLikeMarketplaceSearchPage(finalHtml, finalUrl)) {
    throw new Error(
      `Failed to parse Marketplace listings from a loaded Facebook page. Current URL: ${finalUrl}. Run npm run facebook:login if the page looks wrong, then try again.`,
    );
  }

  throw new Error(
    `No Facebook Marketplace listings found. Current URL: ${finalUrl}. Try broader keywords or confirm Marketplace shows results in your local Facebook browser profile.`,
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
    const photoRecord = record.primary_listing_photo as
      | { image?: { uri?: string } }
      | undefined;
    const imageUrl =
      (typeof photoRecord?.image?.uri === "string" && photoRecord.image.uri.trim()) ||
      stringifyText(record.imageUrl || record.image_url) ||
      undefined;

    listings.push({
      externalId: listingId,
      title,
      price,
      url: `https://www.facebook.com/marketplace/item/${listingId}`,
      imageUrl: imageUrl || undefined,
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
  const byId = new Map<string, RawFacebookListing>();

  for (const listing of listings) {
    const existing = byId.get(listing.externalId);
    if (!existing) {
      byId.set(listing.externalId, listing);
      continue;
    }

    byId.set(listing.externalId, {
      ...existing,
      title: existing.title || listing.title,
      price: existing.price || listing.price,
      url: existing.url || listing.url,
      imageUrl: existing.imageUrl || listing.imageUrl,
      location: existing.location || listing.location,
    });
  }

  return [...byId.values()];
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
