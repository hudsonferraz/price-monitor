import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RawFacebookListing } from "./facebook-dom-parser";
import {
  assertNotRedirectedAway,
  collectAvailableListings,
  hasFacebookLoginWall,
  hasSearchEndSignal,
  looksLikeMarketplaceSearchPage,
  normalizeListings,
  scrollSearchResults,
} from "./facebook-marketplace.adapter";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");
const domFixture = readFileSync(resolve(fixturesDir, "facebook-search-dom.mock.html"), "utf8");
const embeddedFixture = readFileSync(
  resolve(fixturesDir, "facebook-search-embedded.mock.html"),
  "utf8",
);

describe("collectAvailableListings", () => {
  it("counts DOM listings when embedded JSON is missing", () => {
    const listings = collectAvailableListings(domFixture, 24);

    expect(listings).toHaveLength(1);
    expect(listings[0]?.externalId).toBe("4720490308074106");
  });

  it("counts captured GraphQL listings without embedded JSON", () => {
    const listings = collectAvailableListings(domFixture, 24, [
      {
        externalId: "9999999999999999",
        title: "GraphQL listing",
        price: "R$ 100",
        url: "https://www.facebook.com/marketplace/item/9999999999999999",
      },
    ]);

    expect(listings).toHaveLength(2);
  });

  it("prefers embedded JSON ids while still allowing DOM supplement", () => {
    const listings = collectAvailableListings(embeddedFixture, 24);

    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => listing.externalId.length > 0)).toBe(true);
  });

  it("fills missing GraphQL imageUrl from DOM for the same externalId", () => {
    const listings = collectAvailableListings(domFixture, 24, [
      {
        externalId: "4720490308074106",
        title: "GraphQL listing",
        price: "R$ 100",
        url: "https://www.facebook.com/marketplace/item/4720490308074106",
      },
    ]);

    const matched = listings.find((listing) => listing.externalId === "4720490308074106");
    expect(matched?.title).toBe("GraphQL listing");
    expect(matched?.imageUrl).toBeTruthy();
  });

  it("keeps listings even when the page also contains login prompt text", () => {
    const html = `${domFixture}<div>Log in to Facebook</div>`;
    const listings = collectAvailableListings(html, 24);

    expect(hasFacebookLoginWall(html)).toBe(true);
    expect(listings).toHaveLength(1);
  });
});

describe("looksLikeMarketplaceSearchPage", () => {
  it("detects marketplace search pages without login walls", () => {
    expect(
      looksLikeMarketplaceSearchPage(
        domFixture,
        "https://www.facebook.com/marketplace/search?query=iphone",
      ),
    ).toBe(true);
    expect(
      looksLikeMarketplaceSearchPage(
        "<html><title>Log in to Facebook</title></html>",
        "https://www.facebook.com/marketplace/search?query=iphone",
      ),
    ).toBe(false);
  });
});

describe("hasFacebookLoginWall", () => {
  it("detects English and Portuguese Facebook login walls", () => {
    expect(hasFacebookLoginWall("<html><title>Log in to Facebook</title></html>")).toBe(true);
    expect(hasFacebookLoginWall("<form id=\"login_form\"></form>")).toBe(true);
    expect(hasFacebookLoginWall("<main>Entrar no Facebook</main>")).toBe(true);
  });

  it("does not flag normal marketplace HTML", () => {
    expect(hasFacebookLoginWall(domFixture)).toBe(false);
  });
});

function listing(id: string, extra: Partial<RawFacebookListing> = {}): RawFacebookListing {
  return { externalId: id, title: `Listing ${id}`, price: "R$ 100", url: `https://www.facebook.com/marketplace/item/${id}`, ...extra };
}

describe("sold and pending listings", () => {
  it("drops a listing GraphQL marks unavailable, even though the DOM still shows it", () => {
    const listings = collectAvailableListings(domFixture, 24, [listing("4720490308074106", { unavailable: true })]);
    expect(listings.find((entry) => entry.externalId === "4720490308074106")).toBeUndefined();
  });

  it("drops sold and pending listings from embedded JSON", () => {
    const html = `<script type="application/json">[
      {"id": "1", "marketplace_listing_title": "Available", "listing_price": {"formatted_amount": "R$1.000"}},
      {"id": "2", "marketplace_listing_title": "Reserved", "listing_price": {"formatted_amount": "R$1.000"}, "is_pending": true},
      {"id": "3", "marketplace_listing_title": "Gone", "listing_price": {"formatted_amount": "R$1.000"}, "is_sold": true}
    ]</script>`;
    expect(collectAvailableListings(html, 24).map((entry) => entry.externalId)).toEqual(["1"]);
  });
});

describe("hasSearchEndSignal", () => {
  const page = (hasNextPage: boolean) =>
    JSON.stringify({ data: { marketplace_search: { feed_units: { edges: [], page_info: { has_next_page: hasNextPage } } } } });

  it("detects Facebook's last page of search results", () => {
    expect(hasSearchEndSignal(page(false))).toBe(true);
    expect(hasSearchEndSignal(`${page(true)}\n{"extensions":{}}\n${page(false)}`)).toBe(true);
  });

  it("ignores pages with more results and unrelated feeds", () => {
    expect(hasSearchEndSignal(page(true))).toBe(false);
    expect(hasSearchEndSignal(JSON.stringify({ data: { other_feed: { page_info: { has_next_page: false } } } }))).toBe(false);
    expect(hasSearchEndSignal("not json")).toBe(false);
  });
});

describe("assertNotRedirectedAway", () => {
  it("throws classified errors for login, checkpoint and consent", () => {
    expect(() => assertNotRedirectedAway("https://www.facebook.com/login/")).toThrow(/redirected to login/);
    expect(() => assertNotRedirectedAway("https://www.facebook.com/checkpoint/123/")).toThrow(/checkpoint/);
    expect(() => assertNotRedirectedAway("https://www.facebook.com/privacy/consent/x/")).toThrow(/consent/);
    expect(() => assertNotRedirectedAway("https://www.facebook.com/marketplace/search?query=login")).not.toThrow();
  });
});

describe("scrollSearchResults", () => {
  /** A fake page where each scroll may deliver a batch of GraphQL listings. */
  function fakePage(batches: RawFacebookListing[][], captured: RawFacebookListing[], onScroll?: (scroll: number) => void) {
    let scroll = 0;
    return {
      content: async () => "<html></html>",
      mouse: {
        wheel: async () => {
          captured.push(...(batches[scroll] ?? []));
          scroll += 1;
          onScroll?.(scroll);
        },
      },
      waitForTimeout: async () => undefined,
      get scrolls() {
        return scroll;
      },
    };
  }

  it("keeps scrolling past a quiet scroll and collects the later batch", async () => {
    const captured = [listing("1"), listing("2")];
    const page = fakePage([[], [listing("3"), listing("4")]], captured);
    const reason = await scrollSearchResults(page, 24, captured);
    expect(captured).toHaveLength(4);
    expect(reason).toBe("idle");
    expect(page.scrolls).toBe(5); // one quiet scroll, one with data, then 3 quiet in a row
  });

  it("stops as soon as Facebook reports the last page", async () => {
    const captured = [listing("1")];
    const progress = { reachedEnd: false };
    const page = fakePage([[listing("2")]], captured, () => {
      progress.reachedEnd = true;
    });
    expect(await scrollSearchResults(page, 24, captured, progress)).toBe("end_of_results");
    expect(page.scrolls).toBe(1);
  });

  it("stops when the limit is reached", async () => {
    const captured = [listing("1")];
    const page = fakePage([[listing("2"), listing("3")]], captured);
    expect(await scrollSearchResults(page, 3, captured)).toBe("limit_reached");
    expect(page.scrolls).toBe(1);
  });
});

describe("normalizeListings", () => {
  it("keeps titles on one line (seen on a real listing title with a line break)", () => {
    const [normalized] = normalizeListings([listing("1", { title: "iPhone 13 mini 256gb 73% bateria\nTodo origin  " })]);
    expect(normalized?.title).toBe("iPhone 13 mini 256gb 73% bateria Todo origin");
  });
});
