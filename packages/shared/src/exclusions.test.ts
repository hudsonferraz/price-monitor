import { describe, expect, it } from "vitest";
import {
  findExcludedTerm,
  findKeywordConflict,
  normalizeExclusionTerms,
  normalizeForMatching,
  parseExclusionInput,
} from "./exclusions";

describe("normalizeForMatching", () => {
  it("removes accents, case and punctuation", () => {
    expect(normalizeForMatching("  iPhone 13 — PEÇAS/Película!! ")).toBe("iphone 13 pecas pelicula");
  });
});

describe("findExcludedTerm", () => {
  const terms = ["capa", "película", "peças", "tela trincada"];

  it.each([
    ["Capa iPhone 13 silicone", "capa"],
    ["iPhone 13 PECAS", "peças"],
    ["Pelicula de vidro iPhone 13", "película"],
    ["iPhone 13 com tela trincada", "tela trincada"],
    ["iPhone 13 (capa) brinde", "capa"],
  ])("excludes %j", (title, term) => {
    expect(findExcludedTerm(title, terms)).toBe(term);
  });

  it.each(["iPhone 13 128GB", "Capacete de moto", "Escapamento esportivo", "iPhone 13 tela nova, sem trinca"])(
    "keeps %j (whole words and phrases only)",
    (title) => {
      expect(findExcludedTerm(title, terms)).toBeNull();
    },
  );

  it("returns null without terms", () => {
    expect(findExcludedTerm("Capa", [])).toBeNull();
    expect(findExcludedTerm("Capa", null)).toBeNull();
  });
});

describe("normalizeExclusionTerms", () => {
  it("trims, drops empties and accent/case duplicates", () => {
    expect(normalizeExclusionTerms(["  capa ", "", "Capa", "película", "pelicula", "  tela   trincada "])).toEqual([
      "capa",
      "película",
      "tela trincada",
    ]);
  });

  it("parses comma, semicolon and newline separated input", () => {
    expect(parseExclusionInput("capa, película;peças\n , ")).toEqual(["capa", "película", "peças"]);
  });
});

describe("findKeywordConflict", () => {
  it("flags exclusions that would hide the search itself", () => {
    expect(findKeywordConflict("iphone 13", ["capa", "iPhone"])).toBe("iPhone");
    expect(findKeywordConflict("iphone 13", ["13"])).toBe("13");
    expect(findKeywordConflict("iphone 13", ["capa", "iphone 12"])).toBeNull();
  });
});
