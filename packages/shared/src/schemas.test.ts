import { describe, expect, it } from "vitest";
import {
  centsToReais,
  createSavedSearchSchema,
  createUpdateSavedSearchSchema,
} from "./schemas";

describe("createSavedSearchSchema", () => {
  it("rejects a max price below the min price", () => {
    const parsed = createSavedSearchSchema.safeParse({
      name: "Phones",
      keywords: "iphone",
      minPriceReais: 500,
      maxPriceReais: 100,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("createUpdateSavedSearchSchema", () => {
  const existingPrices = {
    minPriceReais: 100,
    maxPriceReais: 500,
  };

  it("rejects lowering max below the existing min when min is omitted", () => {
    const parsed = createUpdateSavedSearchSchema(existingPrices).safeParse({
      maxPriceReais: 50,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects raising min above the existing max when max is omitted", () => {
    const parsed = createUpdateSavedSearchSchema(existingPrices).safeParse({
      minPriceReais: 600,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a partial update that stays within the existing range", () => {
    const parsed = createUpdateSavedSearchSchema(existingPrices).safeParse({
      minPriceReais: 200,
    });

    expect(parsed.success).toBe(true);
  });

  it("validates both prices when both are provided in the patch", () => {
    const parsed = createUpdateSavedSearchSchema(existingPrices).safeParse({
      minPriceReais: 800,
      maxPriceReais: 700,
    });

    expect(parsed.success).toBe(false);
  });

  it("merges null clears with the remaining existing bound", () => {
    const parsed = createUpdateSavedSearchSchema({
      minPriceReais: centsToReais(10_000),
      maxPriceReais: centsToReais(50_000),
    }).safeParse({
      minPriceReais: null,
    });

    expect(parsed.success).toBe(true);
  });
});
