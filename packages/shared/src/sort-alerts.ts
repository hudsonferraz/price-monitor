import type { ListingLimit } from "./queue";
import { DEFAULT_LISTING_LIMIT, LISTING_LIMIT_OPTIONS } from "./queue";

export type AlertSortOption = "date-desc" | "date-asc" | "price-asc" | "price-desc";

export interface SortableAlert {
  createdAt: string;
  listing: { priceCents: number | null };
}

export function sortAlerts<T extends SortableAlert>(alerts: T[], sortBy: AlertSortOption): T[] {
  const sorted = [...alerts];

  sorted.sort((left, right) => {
    switch (sortBy) {
      case "date-asc":
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      case "price-asc": {
        const leftPrice = left.listing.priceCents ?? Number.MAX_SAFE_INTEGER;
        const rightPrice = right.listing.priceCents ?? Number.MAX_SAFE_INTEGER;
        return leftPrice - rightPrice;
      }
      case "price-desc": {
        const leftPrice = left.listing.priceCents ?? -1;
        const rightPrice = right.listing.priceCents ?? -1;
        return rightPrice - leftPrice;
      }
      case "date-desc":
      default:
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }
  });

  return sorted;
}

export function normalizeListingLimit(value: number | null | undefined): ListingLimit {
  if (value != null && (LISTING_LIMIT_OPTIONS as readonly number[]).includes(value)) {
    return value as ListingLimit;
  }
  return DEFAULT_LISTING_LIMIT;
}
