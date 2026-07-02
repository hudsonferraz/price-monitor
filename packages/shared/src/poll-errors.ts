export type PollIssueCode =
  | "FACEBOOK_SESSION"
  | "FACEBOOK_CHECKPOINT"
  | "NO_LISTINGS"
  | "POLL_TIMEOUT"
  | "UNKNOWN";

export function getPollIssueCode(errorMessage: string | null | undefined): PollIssueCode | null {
  if (!errorMessage) {
    return null;
  }

  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("checkpoint")) {
    return "FACEBOOK_CHECKPOINT";
  }

  if (
    normalized.includes("redirected to login") ||
    normalized.includes("login wall") ||
    normalized.includes("storage state") ||
    normalized.includes("facebook-storage-state") ||
    normalized.includes("enoent") ||
    normalized.includes("session expired") ||
    normalized.includes("session")
  ) {
    return "FACEBOOK_SESSION";
  }

  if (normalized.includes("no facebook marketplace listings found")) {
    return "NO_LISTINGS";
  }

  if (normalized.includes("poll timed out")) {
    return "POLL_TIMEOUT";
  }

  return "UNKNOWN";
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
    return "Facebook sent the worker to a checkpoint. Refresh facebook-storage-state.json on Render after clearing the checkpoint locally.";
  }

  if (issueCode === "FACEBOOK_SESSION") {
    return "Facebook session expired or missing on the worker. Refresh facebook-storage-state.json on Render.";
  }

  if (issueCode === "NO_LISTINGS") {
    return "Facebook loaded, but the worker could not extract Marketplace listings. Try a broader search or refresh the Facebook session if this repeats.";
  }

  if (issueCode === "POLL_TIMEOUT") {
    return "Poll timed out. The worker may have been asleep or Facebook took too long to respond. Try Poll now again.";
  }

  return errorMessage ?? "Poll failed for an unknown reason.";
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
