import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectAvailableListings, hasFacebookLoginWall, looksLikeMarketplaceSearchPage } from "./facebook-marketplace.adapter";

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
