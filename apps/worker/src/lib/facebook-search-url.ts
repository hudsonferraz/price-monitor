export interface FacebookSearchUrlOptions {
  keywords: string;
  minPriceCents?: number;
  maxPriceCents?: number;
}

export function buildFacebookMarketplaceSearchUrl({
  keywords,
  minPriceCents,
  maxPriceCents,
}: FacebookSearchUrlOptions): string {
  const params = new URLSearchParams({
    query: keywords.trim(),
  });

  if (minPriceCents != null && minPriceCents > 0) {
    params.set("minPrice", String(Math.floor(minPriceCents / 100)));
  }

  if (maxPriceCents != null && maxPriceCents > 0) {
    params.set("maxPrice", String(Math.floor(maxPriceCents / 100)));
  }

  return `https://www.facebook.com/marketplace/search?${params.toString()}`;
}
