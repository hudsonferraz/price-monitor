import { getPollIssueCode, isFacebookSessionError, type PollIssueCode } from "@price-monitor/shared/poll-errors";

export interface PollHealthSummary {
  failedPollCount24h: number;
  hasFacebookSessionIssue: boolean;
  hasNoListingsIssue: boolean;
  hasTimeoutIssue: boolean;
  latestIssueCode: PollIssueCode | null;
  latestErrorMessage: string | null;
  averageDurationMs: number | null;
}

export function summarizeRecentPollHealth(
  pollRuns: Array<{
    status: string;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: Date;
  }>,
): PollHealthSummary {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentRuns = pollRuns.filter((run) => run.startedAt.getTime() >= cutoff);
  const failedRuns = recentRuns.filter((run) => run.status === "FAILED");
  const successfulDurations = recentRuns
    .filter((run) => run.status === "SUCCESS" && run.durationMs != null)
    .map((run) => run.durationMs as number);
  const latestFailedRun = failedRuns.reduce<(typeof failedRuns)[number] | null>((latest, run) => {
    if (!latest || run.startedAt.getTime() > latest.startedAt.getTime()) {
      return run;
    }
    return latest;
  }, null);
  const issueCodes = failedRuns.map((run) => getPollIssueCode(run.errorMessage));

  const averageDurationMs =
    successfulDurations.length > 0
      ? Math.round(
          successfulDurations.reduce((total, duration) => total + duration, 0) /
            successfulDurations.length,
        )
      : null;

  return {
    failedPollCount24h: failedRuns.length,
    hasFacebookSessionIssue: failedRuns.some((run) => isFacebookSessionError(run.errorMessage)),
    hasNoListingsIssue: issueCodes.includes("NO_LISTINGS"),
    hasTimeoutIssue: issueCodes.includes("POLL_TIMEOUT"),
    latestIssueCode: getPollIssueCode(latestFailedRun?.errorMessage),
    latestErrorMessage: latestFailedRun?.errorMessage ?? null,
    averageDurationMs,
  };
}
