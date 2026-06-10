import { parseHTML } from "linkedom";
import { parseListingsFromEmbeddedJson } from "./facebook-embedded-json-parser.ts";

export interface RawFacebookListing {
  externalId: string;
  title: string;
  price: string;
  url: string;
  imageUrl?: string;
  location?: string;
}

const LISTING_LINK_SELECTOR = "a[href*='/marketplace/item/']";

export function parseListingsFromHtml(html: string, limit = 24): RawFacebookListing[] {
  const fromJson = parseListingsFromEmbeddedJson(html, limit);
  if (fromJson.length > 0) {
    return fromJson;
  }

  return parseListingsFromDom(html, limit);
}

function parseListingsFromDom(html: string, limit: number): RawFacebookListing[] {
  const { document } = parseHTML(html);
  const links = Array.from(document.querySelectorAll(LISTING_LINK_SELECTOR));
  const seen = new Set<string>();
  const listings: RawFacebookListing[] = [];

  for (const anchor of links) {
    const href = anchor.getAttribute("href");
    if (!href) {
      continue;
    }

    const absoluteHref = href.startsWith("http")
      ? href
      : `https://www.facebook.com${href.startsWith("/") ? href : `/${href}`}`;
    const canonicalUrl = absoluteHref.split("?")[0] ?? absoluteHref;

    if (seen.has(canonicalUrl)) {
      continue;
    }
    seen.add(canonicalUrl);

    const ariaLabel = anchor.getAttribute("aria-label")?.trim();
    const parsedFromLabel = ariaLabel ? parseAriaLabel(ariaLabel) : null;

    const card =
      anchor.closest("[data-testid='marketplace-search-result']") ??
      anchor.closest("div[role='article']") ??
      anchor.closest("li") ??
      anchor.parentElement ??
      anchor;

    const title =
      parsedFromLabel?.title ??
      card.querySelector("img")?.getAttribute("alt")?.trim() ??
      extractTitleFromText(card.textContent ?? "") ??
      "";

    const price = parsedFromLabel?.price ?? findPriceText(card) ?? "";
    const location = parsedFromLabel?.location ?? findLocationText(card) ?? undefined;

    const imageElement = card.querySelector("img");
    const imageUrl = imageElement?.getAttribute("src") ?? imageElement?.getAttribute("data-src") ?? undefined;
    const externalId = extractListingId(canonicalUrl);

    if (!externalId || !title) {
      continue;
    }

    listings.push({
      externalId,
      title: cleanTitle(title),
      price,
      url: canonicalUrl,
      imageUrl: imageUrl || undefined,
      location,
    });

    if (listings.length >= limit) {
      break;
    }
  }

  return listings;
}

export function extractListingId(href: string): string | null {
  const match = href.match(/\/marketplace\/item\/(\d+)/i);
  return match?.[1] ?? null;
}

function parseAriaLabel(label: string): { title: string; price: string; location?: string } | null {
  const cleaned = label.replace(/Acabou de ser anunciado/gi, "").trim();
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const priceIndex = parts.findIndex((part) =>
    /^(R\$|US\$|\$)[\d.,]+$/i.test(part) || /^(gratuito|free)$/i.test(part),
  );

  if (priceIndex <= 0) {
    return null;
  }

  const title = parts.slice(0, priceIndex).join(", ").trim();
  const price = parts[priceIndex] ?? "";
  const location = parts.slice(priceIndex + 1).join(", ").trim() || undefined;

  if (!title || !price) {
    return null;
  }

  return { title: cleanTitle(title), price, location };
}

function extractTitleFromText(text: string): string | null {
  const cleaned = text
    .replace(/Acabou de ser anunciado/gi, " ")
    .replace(/(R\$[\d.,]+|US\$[\d.,]+)/gi, " ")
    .replace(/([A-Za-zÀ-ú .'-]+,\s*[A-Z]{2})/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function findPriceText(root: ParentNode): string | undefined {
  const textNodes = Array.from(root.querySelectorAll("span, div"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);

  return textNodes.find((text) => /^(R\$|US\$|\$)\s?[\d.,]+/i.test(text) || /^free$|^gratuito$/i.test(text));
}

function findLocationText(root: ParentNode): string | undefined {
  const textNodes = Array.from(root.querySelectorAll("span, div"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);

  return textNodes.find((text) => /,\s*[A-Z]{2}$/.test(text));
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}
