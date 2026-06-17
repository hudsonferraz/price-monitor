export function isFacebookSessionError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) {
    return false;
  }

  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("redirected to login") ||
    normalized.includes("storage state") ||
    normalized.includes("facebook-storage-state") ||
    normalized.includes("enoent") ||
    normalized.includes("checkpoint") ||
    normalized.includes("session")
  );
}

export function formatPollErrorForDisplay(errorMessage: string | null | undefined): string {
  if (!errorMessage) {
    return "Poll failed for an unknown reason.";
  }

  if (isFacebookSessionError(errorMessage)) {
    return "Facebook session expired or missing on the worker. Refresh facebook-storage-state.json on Render.";
  }

  if (errorMessage.includes("Poll timed out")) {
    return "Poll timed out. The worker may have been asleep or Facebook took too long to respond. Try Poll now again.";
  }

  return errorMessage;
}

export function formatDurationMs(durationMs: number | null | undefined): string {
  if (durationMs == null || durationMs < 0) {
    return "—";
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
