import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_MANUAL_POLL_INTERVAL_MS } from "@price-monitor/shared/poll-rate-limit";
import {
  DEMO_MANUAL_POLL_INTERVAL_MS,
  getManualPollIntervalMs,
  isDemoListingUrl,
  isDemoMode,
} from "./demo-mode";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isDemoMode", () => {
  it("is off when DEMO_MODE is unset", () => {
    vi.stubEnv("DEMO_MODE", "");
    expect(isDemoMode()).toBe(false);
  });

  it("is off for values other than 'true'", () => {
    vi.stubEnv("DEMO_MODE", "1");
    expect(isDemoMode()).toBe(false);
  });

  it("is on with DEMO_MODE=true outside production", () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(isDemoMode()).toBe(true);
  });

  it("is always off in production and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoMode()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getManualPollIntervalMs", () => {
  it("uses the short demo cooldown in demo mode", () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(getManualPollIntervalMs()).toBe(DEMO_MANUAL_POLL_INTERVAL_MS);
    expect(DEMO_MANUAL_POLL_INTERVAL_MS).toBeLessThanOrEqual(60_000);
  });

  it("keeps the normal cooldown otherwise", () => {
    vi.stubEnv("DEMO_MODE", "");
    expect(getManualPollIntervalMs()).toBe(MIN_MANUAL_POLL_INTERVAL_MS);
  });
});

describe("isDemoListingUrl", () => {
  it("detects demo listing links", () => {
    expect(isDemoListingUrl("/demo/listing/demo-abc-1")).toBe(true);
    expect(isDemoListingUrl("https://www.facebook.com/marketplace/item/1")).toBe(false);
    expect(isDemoListingUrl(null)).toBe(false);
  });
});
