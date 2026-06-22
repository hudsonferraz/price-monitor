export const MAX_FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000;

export interface PollRunStatusRecord {
  status: string;
}

export function countConsecutivePollFailures(
  pollRunsNewestFirst: PollRunStatusRecord[],
): number {
  let count = 0;

  for (const run of pollRunsNewestFirst) {
    if (run.status !== "FAILED") {
      break;
    }
    count += 1;
  }

  return count;
}

export function getFailureBackoffMs(
  consecutiveFailures: number,
  pollIntervalMin: number,
): number {
  if (consecutiveFailures <= 0) {
    return 0;
  }

  const baseIntervalMs = pollIntervalMin * 60_000;
  const exponentialMs = baseIntervalMs * 2 ** (consecutiveFailures - 1);
  return Math.min(exponentialMs, MAX_FAILURE_BACKOFF_MS);
}

export function isSearchDueForScheduledPoll(input: {
  pollIntervalMin: number;
  lastAttemptedAt: Date | null;
  lastSuccessfulPollAt: Date | null;
  consecutiveFailures: number;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const intervalMs = input.pollIntervalMin * 60_000;

  if (input.lastAttemptedAt == null) {
    return true;
  }

  const lastAttemptedAtMs = input.lastAttemptedAt.getTime();

  if (input.consecutiveFailures > 0) {
    const backoffMs = getFailureBackoffMs(input.consecutiveFailures, input.pollIntervalMin);
    if (now - lastAttemptedAtMs < backoffMs) {
      return false;
    }
  }

  if (input.lastSuccessfulPollAt == null) {
    return true;
  }

  return now - input.lastSuccessfulPollAt.getTime() >= intervalMs;
}
