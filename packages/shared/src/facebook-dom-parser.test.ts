import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseListingsFromHtml } from "../../../apps/worker/src/adapters/facebook-dom-parser.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockFixturePath = path.resolve(__dirname, "../../../fixtures/facebook-search-dom.mock.html");

describe("parseListingsFromHtml (DOM fallback)", () => {
  it("parses listing data from aria-label when JSON is unavailable", () => {
    const html = readFileSync(mockFixturePath, "utf8");
    const listings = parseListingsFromHtml(html, 5);

    expect(listings).toHaveLength(1);
    expect(listings[0]?.title).toBe("iPhone 13 128GB Azul");
    expect(listings[0]?.externalId).toBe("4720490308074106");
    expect(listings[0]?.location).toBe("São Paulo, SP");
    expect(listings[0]?.price).toBe("R$2.450");
    expect(listings[0]?.url).toBe("https://www.facebook.com/marketplace/item/4720490308074106");
  });
});
