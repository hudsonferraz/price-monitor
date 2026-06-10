import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseListingsFromEmbeddedJson } from "../../../apps/worker/src/adapters/facebook-embedded-json-parser.ts";
import { parseBrazilianPriceToCents } from "./parse-price.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockFixturePath = path.resolve(
  __dirname,
  "../../../fixtures/facebook-search-embedded.mock.html",
);

describe("parseListingsFromEmbeddedJson", () => {
  it("extracts structured listings from embedded JSON in HTML", () => {
    const html = readFileSync(mockFixturePath, "utf8");
    const listings = parseListingsFromEmbeddedJson(html, 10);

    expect(listings).toHaveLength(5);
    expect(listings[0]?.title).toBe("Iphone 13");
    expect(listings[0]?.location).toBe("Montes Claros, MG");
    expect(parseBrazilianPriceToCents(listings[0]?.price ?? "")).toBe(170_000);
    expect(listings[0]?.url).toBe("https://www.facebook.com/marketplace/item/1586689033062352");
    expect(listings[0]?.imageUrl).toBe("https://example.com/iphone-13.jpg");
  });

  it("returns unique listing ids", () => {
    const html = readFileSync(mockFixturePath, "utf8");
    const listings = parseListingsFromEmbeddedJson(html, 50);
    const ids = listings.map((listing) => listing.externalId);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
