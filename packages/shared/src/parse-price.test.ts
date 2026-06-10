import { describe, expect, it } from "vitest";
import { parseBrazilianPriceToCents } from "./parse-price.ts";

describe("parseBrazilianPriceToCents", () => {
  it("parses whole reais with thousands separator", () => {
    expect(parseBrazilianPriceToCents("R$ 1.200")).toBe(120_000);
    expect(parseBrazilianPriceToCents("R$1.700")).toBe(170_000);
  });

  it("parses decimal reais", () => {
    expect(parseBrazilianPriceToCents("R$ 850,50")).toBe(85_050);
    expect(parseBrazilianPriceToCents("R$1.700,50")).toBe(170_050);
  });

  it("returns null for free listings", () => {
    expect(parseBrazilianPriceToCents("Grátis")).toBeNull();
    expect(parseBrazilianPriceToCents("Gratuito")).toBeNull();
  });
});
