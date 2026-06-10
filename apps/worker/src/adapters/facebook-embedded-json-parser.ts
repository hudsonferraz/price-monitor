import { parseHTML } from "linkedom";
import type { RawFacebookListing } from "./facebook-dom-parser.ts";

interface FacebookListingRecord {
  id?: string;
  marketplace_listing_title?: string;
  listing_price?: {
    formatted_amount?: string;
    amount?: string;
  };
  strikethrough_price?: {
    formatted_amount?: string;
  } | null;
  location?: {
    reverse_geocode?: {
      city?: string;
      state?: string;
    };
  };
  primary_listing_photo?: {
    image?: {
      uri?: string;
    };
  };
  is_pending?: boolean;
  is_sold?: boolean;
}

export function parseListingsFromEmbeddedJson(html: string, limit = 24): RawFacebookListing[] {
  const { document } = parseHTML(html);
  const scripts = document.querySelectorAll('script[type="application/json"]');
  const listings: RawFacebookListing[] = [];
  const seen = new Set<string>();

  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text || !text.includes("marketplace_listing_title")) {
      continue;
    }

    try {
      const records = findListingRecords(JSON.parse(text));
      for (const record of records) {
        const listing = mapRecordToListing(record);
        if (!listing || seen.has(listing.externalId)) {
          continue;
        }

        seen.add(listing.externalId);
        listings.push(listing);

        if (listings.length >= limit) {
          return listings;
        }
      }
    } catch {
      continue;
    }
  }

  return listings;
}

function findListingRecords(payload: unknown, depth = 0): FacebookListingRecord[] {
  if (depth > 20 || payload == null) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => findListingRecords(entry, depth + 1));
  }

  if (typeof payload !== "object") {
    return [];
  }

  const record = payload as FacebookListingRecord;
  const results: FacebookListingRecord[] = [];

  if (typeof record.marketplace_listing_title === "string" && typeof record.id === "string") {
    results.push(record);
  }

  for (const value of Object.values(record as Record<string, unknown>)) {
    results.push(...findListingRecords(value, depth + 1));
  }

  return results;
}

function mapRecordToListing(record: FacebookListingRecord): RawFacebookListing | null {
  const externalId = record.id?.trim();
  const title = record.marketplace_listing_title?.trim();

  if (!externalId || !title || record.is_sold) {
    return null;
  }

  const city = record.location?.reverse_geocode?.city?.trim();
  const state = record.location?.reverse_geocode?.state?.trim();
  const location = city && state ? `${city}, ${state}` : city ?? undefined;

  return {
    externalId,
    title,
    price: record.listing_price?.formatted_amount ?? record.listing_price?.amount ?? "",
    url: `https://www.facebook.com/marketplace/item/${externalId}`,
    imageUrl: record.primary_listing_photo?.image?.uri,
    location,
  };
}
