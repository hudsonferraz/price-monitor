export interface PollQueueMessageInput {
  queued: boolean;
  jobState?: string;
  blockingSearchName?: string | null;
  waitingForAnotherPoll?: boolean;
  waitingPosition?: number;
}

function formatBlockingPollMessage(
  blockingSearchName: string | null | undefined,
  waitingForAnotherPoll: boolean | undefined,
  suffix: string,
): string | null {
  if (!waitingForAnotherPoll && !blockingSearchName) {
    return null;
  }

  const targetLabel = blockingSearchName ? `"${blockingSearchName}"` : "another search";
  return `${suffix} ${targetLabel} to finish first (one poll at a time).`;
}

export function formatPollQueueMessage(input: PollQueueMessageInput): string {
  if (input.queued) {
    const blockingMessage = formatBlockingPollMessage(
      input.blockingSearchName,
      input.waitingForAnotherPoll,
      "Poll queued — waiting for",
    );

    if (blockingMessage) {
      const positionNote =
        input.waitingPosition != null && input.waitingPosition > 1
          ? ` You are #${input.waitingPosition} in line.`
          : "";
      return `${blockingMessage}${positionNote} Updating automatically.`;
    }

    return "Poll queued. The worker may take up to a minute to start, then results will appear shortly. Updating automatically.";
  }

  if (input.jobState === "active") {
    return "A poll is already running for this search.";
  }

  if (input.jobState === "waiting" || input.jobState === "delayed") {
    const blockingMessage = formatBlockingPollMessage(
      input.blockingSearchName,
      input.waitingForAnotherPoll,
      "Poll already queued — waiting for",
    );

    if (blockingMessage) {
      return blockingMessage;
    }

    return "A poll is already queued. The worker may take up to a minute to start on the free tier.";
  }

  return "A poll is already in progress for this search.";
}
