import { describe, expect, it } from "vitest";
import {
  generateMockCatalog,
  isMockListingExternalId,
  MOCK_CATALOG_MAX_RESULTS,
} from "./mock-catalog";

const base = { seed: "search-1", keywords: "iphone 13", pollSequence: 0 };

function byId(listings: ReturnType<typeof generateMockCatalog>) {
  return new Map(listings.map((listing) => [listing.externalId, listing]));
}

describe("generateMockCatalog", () => {
  it("is deterministic for the same input", () => {
    expect(generateMockCatalog({ ...base, pollSequence: 4 })).toEqual(
      generateMockCatalog({ ...base, pollSequence: 4 }),
    );
  });

  it("returns about 20 listings on the baseline poll", () => {
    expect(generateMockCatalog(base)).toHaveLength(MOCK_CATALOG_MAX_RESULTS);
  });

  it("caps results at the listing limit", () => {
    expect(generateMockCatalog({ ...base, limit: 12 })).toHaveLength(12);
    expect(generateMockCatalog({ ...base, limit: 48 })).toHaveLength(MOCK_CATALOG_MAX_RESULTS);
  });

  it("keeps the keyword as typed in titles, including accents", () => {
    for (const listing of generateMockCatalog({ ...base, keywords: "câmera  canon" })) {
      expect(listing.title.toLocaleLowerCase("pt-BR")).toContain("câmera canon");
    }
  });

  it("falls back to a generic keyword when empty", () => {
    const listings = generateMockCatalog({ ...base, keywords: "   " });
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].title.toLowerCase()).toContain("item");
  });

  it("uses demo ids, demo urls, local images and BRL prices", () => {
    for (const listing of generateMockCatalog(base)) {
      expect(isMockListingExternalId(listing.externalId)).toBe(true);
      expect(listing.url).toBe(`/demo/listing/${listing.externalId}`);
      expect(listing.url).not.toContain("facebook");
      expect(listing.imageUrl).toMatch(/^\/demo\/listing-[1-8]\.svg$/);
      expect(listing.currency).toBe("BRL");
      expect(listing.priceCents! % 100).toBe(0);
      expect(listing.location).toMatch(/, [A-Z]{2}$/);
    }
  });

  it("keeps ids stable across sequences for the same search", () => {
    const first = byId(generateMockCatalog(base));
    const second = byId(generateMockCatalog({ ...base, pollSequence: 1 }));
    const shared = [...second.keys()].filter((id) => first.has(id));
    expect(shared.length).toBeGreaterThanOrEqual(15);
  });

  it("uses different listings for different searches", () => {
    const a = byId(generateMockCatalog(base));
    const b = byId(generateMockCatalog({ ...base, seed: "search-2" }));
    expect([...a.keys()].some((id) => b.has(id))).toBe(false);
  });

  it.each([24, 12])("produces a new listing and a price drop on every later poll (limit %i)", (limit) => {
    for (let sequence = 1; sequence <= 15; sequence += 1) {
      const previous = byId(generateMockCatalog({ ...base, limit, pollSequence: sequence - 1 }));
      const current = generateMockCatalog({ ...base, limit, pollSequence: sequence });

      const newListings = current.filter((listing) => !previous.has(listing.externalId));
      const drops = current.filter((listing) => {
        const before = previous.get(listing.externalId);
        return before != null && listing.priceCents! < before.priceCents!;
      });

      expect(newListings.length, `sequence ${sequence} new`).toBeGreaterThanOrEqual(1);
      expect(drops.length, `sequence ${sequence} drops`).toBeGreaterThanOrEqual(1);
    }
  });

  it("moves prices both ways over time, like real sellers", () => {
    let drops = 0;
    let raises = 0;
    for (let sequence = 1; sequence <= 8; sequence += 1) {
      const previous = byId(generateMockCatalog({ ...base, pollSequence: sequence - 1 }));
      for (const listing of generateMockCatalog({ ...base, pollSequence: sequence })) {
        const before = previous.get(listing.externalId);
        if (before && listing.priceCents! < before.priceCents!) drops += 1;
        if (before && listing.priceCents! > before.priceCents!) raises += 1;
      }
    }
    expect(drops).toBeGreaterThan(0);
    expect(raises).toBeGreaterThan(0);
  });

  it("respects min and max price filters", () => {
    const listings = generateMockCatalog({
      ...base,
      minPriceCents: 200_000,
      maxPriceCents: 350_000,
    });
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.priceCents!).toBeGreaterThanOrEqual(200_000);
      expect(listing.priceCents!).toBeLessThanOrEqual(350_000);
    }
  });

  it("returns nothing when the price range cannot match", () => {
    expect(generateMockCatalog({ ...base, minPriceCents: 1, maxPriceCents: 500 })).toEqual([]);
  });
});
