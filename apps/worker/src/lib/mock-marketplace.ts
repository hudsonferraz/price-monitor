import type { NormalizedListing } from "@price-monitor/shared/types";
import { SOURCE } from "@price-monitor/shared/types";

export function getMockListings(keywords: string): NormalizedListing[] {
  const slug = keywords.trim().toLowerCase().replace(/\s+/g, "-") || "item";

  return [
    {
      externalId: `mock-${slug}-1`,
      title: `${keywords} — mock listing A`,
      priceCents: 150_000,
      currency: "BRL",
      url: "https://www.facebook.com/marketplace/item/mock-a",
      location: "São Paulo, SP",
    },
    {
      externalId: `mock-${slug}-2`,
      title: `${keywords} — mock listing B`,
      priceCents: 220_000,
      currency: "BRL",
      url: "https://www.facebook.com/marketplace/item/mock-b",
      location: "Rio de Janeiro, RJ",
    },
  ];
}

export function isMockMarketplaceEnabled(): boolean {
  return process.env.MOCK_MARKETPLACE === "true";
}
