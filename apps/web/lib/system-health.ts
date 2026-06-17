import { formatDurationMs, isFacebookSessionError } from "@price-monitor/shared/poll-errors";

export interface WorkerHealthStatus {
  configured: boolean;
  online: boolean | null;
  latencyMs: number | null;
  checkedAt: string | null;
}

export async function fetchWorkerHealthStatus(): Promise<WorkerHealthStatus> {
  const healthUrl = process.env.WORKER_HEALTH_URL;
  if (!healthUrl) {
    return {
      configured: false,
      online: null,
      latencyMs: null,
      checkedAt: null,
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    return {
      configured: true,
      online: response.ok,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      configured: true,
      online: false,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

export interface PollHealthSummary {
  failedPollCount24h: number;
  hasFacebookSessionIssue: boolean;
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
    averageDurationMs,
  };
}

export function formatAveragePollDuration(averageDurationMs: number | null): string {
  return averageDurationMs == null ? "—" : formatDurationMs(averageDurationMs);
}
