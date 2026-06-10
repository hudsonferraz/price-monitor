import { z } from "zod";

const savedSearchFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  keywords: z.string().trim().min(1, "Keywords are required").max(200),
  minPriceReais: z.number().min(0).optional().nullable(),
  maxPriceReais: z.number().min(0).optional().nullable(),
  pollIntervalMin: z.coerce.number().int().min(5).max(1440).default(30),
  isEnabled: z.boolean().default(true),
});

export const createSavedSearchSchema = savedSearchFieldsSchema.refine(
  (data) => {
    if (data.minPriceReais != null && data.maxPriceReais != null) {
      return data.minPriceReais <= data.maxPriceReais;
    }
    return true;
  },
  { message: "Minimum price must be less than or equal to maximum price" },
);

export const updateSavedSearchSchema = savedSearchFieldsSchema.partial();

export function reaisToCents(reais: number | null | undefined): number | null {
  if (reais == null) {
    return null;
  }
  return Math.round(reais * 100);
}

export function centsToReais(cents: number | null | undefined): number | null {
  if (cents == null) {
    return null;
  }
  return cents / 100;
}
