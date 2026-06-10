export const SOURCE = {
  FACEBOOK: "FACEBOOK",
} as const;

export type Source = (typeof SOURCE)[keyof typeof SOURCE];

export interface SearchInput {
  keywords: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  limit?: number;
}

export interface NormalizedListing {
  externalId: string;
  title: string;
  priceCents: number | null;
  currency: string;
  url: string;
  imageUrl?: string;
  location?: string;
}

export interface MarketplaceAdapter {
  source: Source;
  search(input: SearchInput): Promise<NormalizedListing[]>;
}
