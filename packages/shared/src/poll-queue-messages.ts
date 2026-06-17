export interface PollQueueMessageInput {
  queued: boolean;
  jobState?: string;
  blockingSearchName?: string | null;
  waitingPosition?: number;
}

export function formatPollQueueMessage(input: PollQueueMessageInput): string {
  if (input.queued) {
    if (input.blockingSearchName) {
      const positionNote =
        input.waitingPosition != null && input.waitingPosition > 1
          ? ` You are #${input.waitingPosition} in line.`
          : "";
      return `Poll queued — waiting for "${input.blockingSearchName}" to finish first (one poll at a time).${positionNote} Updating automatically.`;
    }

    return "Poll queued. The worker may take up to a minute to start, then results will appear shortly. Updating automatically.";
  }

  if (input.jobState === "active") {
    return "A poll is already running for this search.";
  }

  if (input.jobState === "waiting" || input.jobState === "delayed") {
    if (input.blockingSearchName) {
      return `Poll already queued — waiting for "${input.blockingSearchName}" to finish first (one poll at a time).`;
    }

    return "A poll is already queued. The worker may take up to a minute to start on the free tier.";
  }

  return "A poll is already in progress for this search.";
}
