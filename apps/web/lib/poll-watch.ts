export interface PollWatchContext {
  ignoredRunId: string | null;
  minStartedAtMs: number;
}

export interface PollRunSnapshot {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
}

export function createPollNowWatchContext(latestRunId: string | null | undefined): PollWatchContext {
  return {
    ignoredRunId: latestRunId ?? null,
    minStartedAtMs: Date.now() - 2_000,
  };
}

export function createRunningPollWatchContext(runStartedAt: string): PollWatchContext {
  return {
    ignoredRunId: null,
    minStartedAtMs: new Date(runStartedAt).getTime() - 1_000,
  };
}

export function isTerminalPollRunFromWatch(
  run: PollRunSnapshot,
  context: PollWatchContext,
): boolean {
  if (run.status !== "SUCCESS" && run.status !== "FAILED") {
    return false;
  }

  if (context.ignoredRunId && run.id === context.ignoredRunId) {
    return false;
  }

  return new Date(run.startedAt).getTime() >= context.minStartedAtMs;
}
