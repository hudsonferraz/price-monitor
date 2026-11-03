import { z } from "zod";

import { LISTING_LIMIT_OPTIONS } from "./queue";

const listingLimitSchema = z.coerce
  .number()
  .int()
  .refine((value) => (LISTING_LIMIT_OPTIONS as readonly number[]).includes(value), {
    message: "Listing limit must be 12, 24, or 48",
  })
  .default(24);

const PRICE_RANGE_ERROR = "Minimum price must be less than or equal to maximum price";

function isPriceRangeValid(
  minPriceReais: number | null | undefined,
  maxPriceReais: number | null | undefined,
): boolean {
  if (minPriceReais != null && maxPriceReais != null) {
    return minPriceReais <= maxPriceReais;
  }

  return true;
}

const savedSearchFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  keywords: z.string().trim().min(1, "Keywords are required").max(200),
  minPriceReais: z.number().min(0).optional().nullable(),
  maxPriceReais: z.number().min(0).optional().nullable(),
  pollIntervalMin: z.coerce.number().int().min(5).max(1440).default(30),
  listingLimit: listingLimitSchema,
  isEnabled: z.boolean().default(true),
  notificationsEnabled: z.boolean().default(true),
});

export const createSavedSearchSchema = savedSearchFieldsSchema.refine(
  (data) => isPriceRangeValid(data.minPriceReais, data.maxPriceReais),
  { message: PRICE_RANGE_ERROR },
);

export const savedSearchFieldsPartialSchema = savedSearchFieldsSchema.partial();

export function createUpdateSavedSearchSchema(existingPrices: {
  minPriceReais: number | null;
  maxPriceReais: number | null;
}) {
  return savedSearchFieldsPartialSchema.superRefine((data, context) => {
    const minPriceReais =
      data.minPriceReais !== undefined ? data.minPriceReais : existingPrices.minPriceReais;
    const maxPriceReais =
      data.maxPriceReais !== undefined ? data.maxPriceReais : existingPrices.maxPriceReais;

    if (!isPriceRangeValid(minPriceReais, maxPriceReais)) {
      context.addIssue({
        code: "custom",
        message: PRICE_RANGE_ERROR,
        path: ["maxPriceReais"],
      });
    }
  });
}

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

const minuteOfDaySchema = z.number().int().min(0).max(1439).nullable();

/** PATCH /api/telegram: every field optional; at least one required. */
export const telegramSettingsSchema = z
  .object({
    paused: z.boolean(),
    mode: z.enum(["NEW_AND_DROPS", "DROPS_ONLY"]),
    minDropPercent: z.number().int().min(0).max(90),
    quietStartMinute: minuteOfDaySchema,
    quietEndMinute: minuteOfDaySchema,
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Unknown time zone"),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "No settings to update" })
  .refine(
    (data) =>
      data.quietStartMinute === undefined ||
      data.quietEndMinute === undefined ||
      (data.quietStartMinute === null) === (data.quietEndMinute === null),
    { message: "Quiet hours need both a start and an end" },
  );
