export type PollIssueCode =
  | "FACEBOOK_SESSION"
  | "FACEBOOK_CHECKPOINT"
  | "BROWSER_PROFILE_LOCKED"
  | "NO_LISTINGS"
  | "PARSE_EMPTY"
  | "POLL_TIMEOUT"
  | "UNKNOWN";

const MAX_STORED_POLL_ERROR_CHARS = 280;

export function getPollIssueCode(errorMessage: string | null | undefined): PollIssueCode | null {
  if (!errorMessage) {
    return null;
  }

  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("checkpoint")) {
    return "FACEBOOK_CHECKPOINT";
  }

  if (
    normalized.includes("browser profile is already in use") ||
    normalized.includes("existing browser session") ||
    normalized.includes("navegador existente") ||
    normalized.includes("launchpersistentcontext") ||
    normalized.includes("target page, context or browser has been closed") ||
    normalized.includes("browser logs:")
  ) {
    return "BROWSER_PROFILE_LOCKED";
  }

  if (
    normalized.includes("redirected to login") ||
    normalized.includes("login wall") ||
    normalized.includes("session expired") ||
    normalized.includes("facebook session")
  ) {
    return "FACEBOOK_SESSION";
  }

  if (normalized.includes("failed to parse marketplace listings")) {
    return "PARSE_EMPTY";
  }

  if (normalized.includes("no facebook marketplace listings found")) {
    return "NO_LISTINGS";
  }

  if (normalized.includes("poll timed out")) {
    return "POLL_TIMEOUT";
  }

  return "UNKNOWN";
}

/**
 * Strip Playwright/Chromium launch dumps down to a short, storable message.
 * Classified failures become stable English keys that the UI can localize.
 */
export function sanitizePollErrorMessage(errorMessage: string | null | undefined): string {
  if (!errorMessage?.trim()) {
    return "Unknown poll error";
  }

  const issueCode = getPollIssueCode(errorMessage);

  if (issueCode === "BROWSER_PROFILE_LOCKED") {
    return "Facebook browser profile is already in use. Close other Chrome windows using .facebook-profile.";
  }

  if (issueCode === "FACEBOOK_CHECKPOINT") {
    return "Facebook redirected to checkpoint";
  }

  if (issueCode === "FACEBOOK_SESSION") {
    return "Facebook session expired or login wall detected";
  }

  if (issueCode === "PARSE_EMPTY") {
    return "Failed to parse Marketplace listings from a loaded Facebook page.";
  }

  if (issueCode === "NO_LISTINGS") {
    return "No Facebook Marketplace listings found.";
  }

  if (issueCode === "POLL_TIMEOUT") {
    return "Poll timed out before completing.";
  }

  const firstLine = errorMessage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.toLowerCase().startsWith("browser logs"));

  const compact = (firstLine ?? errorMessage).replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_STORED_POLL_ERROR_CHARS) {
    return compact;
  }

  return `${compact.slice(0, MAX_STORED_POLL_ERROR_CHARS - 1)}…`;
}

export function isFacebookSessionError(errorMessage: string | null | undefined): boolean {
  const issueCode = getPollIssueCode(errorMessage);
  return issueCode === "FACEBOOK_SESSION" || issueCode === "FACEBOOK_CHECKPOINT";
}

export function isNoListingsPollError(errorMessage: string | null | undefined): boolean {
  return getPollIssueCode(errorMessage) === "NO_LISTINGS";
}

export function formatPollErrorForDisplay(errorMessage: string | null | undefined): string {
  const issueCode = getPollIssueCode(errorMessage);

  if (!issueCode) {
    return "Poll failed for an unknown reason.";
  }

  if (issueCode === "FACEBOOK_CHECKPOINT") {
    return "Facebook sent the worker to a checkpoint. Run npm run facebook:login locally and clear the prompt in the browser profile.";
  }

  if (issueCode === "BROWSER_PROFILE_LOCKED") {
    return "The Facebook browser profile is already open in another Chrome/Playwright window. Close facebook:login and any Chrome using .facebook-profile, then retry the poll.";
  }

  if (issueCode === "FACEBOOK_SESSION") {
    return "Facebook session expired or missing on the worker. Run npm run facebook:login locally and confirm Marketplace loads.";
  }

  if (issueCode === "PARSE_EMPTY") {
    return "Facebook Marketplace loaded, but the scraper could not parse listing cards. Refresh the Facebook session or try again after a Marketplace layout change.";
  }

  if (issueCode === "NO_LISTINGS") {
    return "Facebook loaded, but no Marketplace listings matched this search. Try broader keywords, a wider price range, or confirm Marketplace shows results in your browser profile.";
  }

  if (issueCode === "POLL_TIMEOUT") {
    return "Poll timed out. The local worker may have been busy or Facebook took too long to respond. Try Poll now again.";
  }

  return sanitizePollErrorMessage(errorMessage);
}

export function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs == null || durationMs < 0) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
