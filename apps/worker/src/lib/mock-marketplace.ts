import { generateMockCatalog } from "@price-monitor/shared/mock-catalog";
import type { NormalizedListing, SearchInput } from "@price-monitor/shared/types";

export const DEFAULT_MOCK_MARKETPLACE_DELAY_MS = 2500;
export const SIMULATED_MOCK_FAILURE_MESSAGE =
  "Poll timed out while loading Marketplace results (simulated demo failure).";

export interface MockSearchContext {
  savedSearchId: string;
  /** Successful polls before this one; drives how the mock catalog evolves. */
  pollSequence: number;
}

export interface MockMarketplaceDeps {
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function isMockMarketplaceEnabled(): boolean {
  return process.env.MOCK_MARKETPLACE === "true";
}

export function getMockMarketplaceDelayMs(): number {
  const raw = process.env.MOCK_MARKETPLACE_DELAY_MS;
  if (raw == null || raw.trim() === "") {
    return DEFAULT_MOCK_MARKETPLACE_DELAY_MS;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MOCK_MARKETPLACE_DELAY_MS;
}

export function getMockMarketplaceFailureRate(): number {
  const value = Number(process.env.MOCK_MARKETPLACE_FAILURE_RATE ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Demo-mode replacement for the Facebook scrape: no browser, no network, no profile access.
 * Waits briefly so poll status transitions are visible, and can simulate failures.
 */
export async function searchMockMarketplace(
  input: SearchInput,
  context: MockSearchContext,
  deps: MockMarketplaceDeps = {},
): Promise<NormalizedListing[]> {
  const random = deps.random ?? Math.random;
  const sleep = deps.sleep ?? defaultSleep;

  const delayMs = getMockMarketplaceDelayMs();
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  // Not seeded on purpose: failed polls do not advance pollSequence, so a seeded
  // failure would repeat on every retry.
  if (random() < getMockMarketplaceFailureRate()) {
    throw new Error(SIMULATED_MOCK_FAILURE_MESSAGE);
  }

  return generateMockCatalog({
    seed: context.savedSearchId,
    keywords: input.keywords,
    pollSequence: context.pollSequence,
    minPriceCents: input.minPriceCents,
    maxPriceCents: input.maxPriceCents,
    limit: input.limit,
  });
}
