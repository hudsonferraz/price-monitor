import { z } from "zod";

export interface PaginationLimitOptions {
  defaultLimit: number;
  maxLimit: number;
}

export function parsePaginationLimit(
  rawValue: string | null,
  options: PaginationLimitOptions,
): number {
  if (rawValue == null || rawValue.trim() === "") {
    return options.defaultLimit;
  }

  const parsed = z.coerce.number().int().safeParse(rawValue);
  if (!parsed.success || parsed.data < 1) {
    return options.defaultLimit;
  }

  return Math.min(parsed.data, options.maxLimit);
}
