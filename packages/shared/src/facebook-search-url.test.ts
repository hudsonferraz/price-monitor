import { describe, expect, it } from "vitest";
import { buildFacebookMarketplaceSearchUrl } from "../../../apps/worker/src/lib/facebook-search-url.ts";

describe("buildFacebookMarketplaceSearchUrl", () => {
  it("builds a marketplace search url from keywords", () => {
    expect(
      buildFacebookMarketplaceSearchUrl({
        keywords: "iphone 13",
      }),
    ).toBe("https://www.facebook.com/marketplace/search?query=iphone+13");
  });

  it("includes optional price filters", () => {
    expect(
      buildFacebookMarketplaceSearchUrl({
        keywords: "iphone 13",
        minPriceCents: 80_000,
        maxPriceCents: 250_000,
      }),
    ).toBe(
      "https://www.facebook.com/marketplace/search?query=iphone+13&minPrice=800&maxPrice=2500",
    );
  });
});
