import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMockCatalog } from "@price-monitor/shared/mock-catalog";
import { getPollIssueCode, sanitizePollErrorMessage } from "@price-monitor/shared/poll-errors";
import {
  DEFAULT_MOCK_MARKETPLACE_DELAY_MS,
  getMockMarketplaceDelayMs,
  getMockMarketplaceFailureRate,
  searchMockMarketplace,
  SIMULATED_MOCK_FAILURE_MESSAGE,
} from "./mock-marketplace";

afterEach(() => {
  vi.unstubAllEnvs();
});

const input = { keywords: "bicicleta aro 29", maxPriceCents: 300_000, limit: 24 };
const context = { savedSearchId: "search-1", pollSequence: 3 };

describe("mock marketplace settings", () => {
  it("defaults the delay and rejects invalid values", () => {
    vi.stubEnv("MOCK_MARKETPLACE_DELAY_MS", "");
    expect(getMockMarketplaceDelayMs()).toBe(DEFAULT_MOCK_MARKETPLACE_DELAY_MS);
    vi.stubEnv("MOCK_MARKETPLACE_DELAY_MS", "-5");
    expect(getMockMarketplaceDelayMs()).toBe(DEFAULT_MOCK_MARKETPLACE_DELAY_MS);
    vi.stubEnv("MOCK_MARKETPLACE_DELAY_MS", "0");
    expect(getMockMarketplaceDelayMs()).toBe(0);
  });

  it("defaults the failure rate to 0 and clamps it to [0, 1]", () => {
    vi.stubEnv("MOCK_MARKETPLACE_FAILURE_RATE", "");
    expect(getMockMarketplaceFailureRate()).toBe(0);
    vi.stubEnv("MOCK_MARKETPLACE_FAILURE_RATE", "2");
    expect(getMockMarketplaceFailureRate()).toBe(1);
    vi.stubEnv("MOCK_MARKETPLACE_FAILURE_RATE", "abc");
    expect(getMockMarketplaceFailureRate()).toBe(0);
  });
});

describe("searchMockMarketplace", () => {
  it("waits the configured delay and returns the deterministic catalog", async () => {
    vi.stubEnv("MOCK_MARKETPLACE_DELAY_MS", "1200");
    const sleep = vi.fn(async () => undefined);

    const listings = await searchMockMarketplace(input, context, { sleep, random: () => 0.99 });

    expect(sleep).toHaveBeenCalledWith(1200);
    expect(listings).toEqual(
      generateMockCatalog({ seed: "search-1", pollSequence: 3, ...input }),
    );
  });

  it("never fails when the failure rate is 0", async () => {
    vi.stubEnv("MOCK_MARKETPLACE_FAILURE_RATE", "0");
    await expect(
      searchMockMarketplace(input, context, { sleep: async () => undefined, random: () => 0 }),
    ).resolves.toBeInstanceOf(Array);
  });

  it("throws a simulated timeout that existing failure handling classifies", async () => {
    vi.stubEnv("MOCK_MARKETPLACE_FAILURE_RATE", "0.5");
    await expect(
      searchMockMarketplace(input, context, { sleep: async () => undefined, random: () => 0.1 }),
    ).rejects.toThrow(SIMULATED_MOCK_FAILURE_MESSAGE);

    expect(getPollIssueCode(SIMULATED_MOCK_FAILURE_MESSAGE)).toBe("POLL_TIMEOUT");
    expect(getPollIssueCode(sanitizePollErrorMessage(SIMULATED_MOCK_FAILURE_MESSAGE))).toBe(
      "POLL_TIMEOUT",
    );
  });
});
