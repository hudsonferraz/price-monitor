import { MOCK_LISTING_URL_PREFIX } from "@price-monitor/shared/mock-catalog";
import { MIN_MANUAL_POLL_INTERVAL_MS } from "@price-monitor/shared/poll-rate-limit";

export { DEMO_USER_EMAIL, DEMO_USER_NAME } from "@price-monitor/shared/demo";
export const DEMO_MANUAL_POLL_INTERVAL_MS = 30 * 1000;

let warnedAboutProductionDemoMode = false;

/**
 * Demo mode is a local-development affordance: it enables one-click demo sign-in.
 * It is always off in production builds, even when DEMO_MODE=true.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== "true") {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    if (!warnedAboutProductionDemoMode) {
      warnedAboutProductionDemoMode = true;
      console.warn("DEMO_MODE=true is ignored in production builds; demo sign-in is disabled.");
    }
    return false;
  }

  return true;
}

export function getManualPollIntervalMs(): number {
  return isDemoMode() ? DEMO_MANUAL_POLL_INTERVAL_MS : MIN_MANUAL_POLL_INTERVAL_MS;
}

export function isDemoListingUrl(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith(MOCK_LISTING_URL_PREFIX));
}
