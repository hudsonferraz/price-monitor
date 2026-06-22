import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectAvailableListings } from "./facebook-marketplace.adapter";

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

  it("prefers embedded JSON and ignores DOM when embedded data exists", () => {
    const listings = collectAvailableListings(embeddedFixture, 24);

    expect(listings.length).toBeGreaterThan(0);
    expect(listings.every((listing) => listing.externalId.length > 0)).toBe(true);
  });
});
