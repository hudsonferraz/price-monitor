export interface PollQueueMessageInput {
  queued: boolean;
  jobState?: string;
  blockingSearchName?: string | null;
  waitingForAnotherPoll?: boolean;
  waitingPosition?: number;
}

export type PollQueueMessageCode =
  | "POLL_QUEUE_QUEUED"
  | "POLL_QUEUE_QUEUED_BEHIND_NAMED"
  | "POLL_QUEUE_QUEUED_BEHIND_GENERIC"
  | "POLL_QUEUE_ALREADY_RUNNING"
  | "POLL_QUEUE_ALREADY_QUEUED_BEHIND_NAMED"
  | "POLL_QUEUE_ALREADY_QUEUED_BEHIND_GENERIC"
  | "POLL_QUEUE_ALREADY_QUEUED"
  | "POLL_QUEUE_ALREADY_IN_PROGRESS";

export interface PollQueueMessageDescriptor {
  messageCode: PollQueueMessageCode;
  searchName?: string;
  waitingPosition?: number;
}

function isBlockedByAnotherPoll(
  blockingSearchName: string | null | undefined,
  waitingForAnotherPoll: boolean | undefined,
): boolean {
  return Boolean(waitingForAnotherPoll || blockingSearchName);
}

function resolveQueuedMessage(input: PollQueueMessageInput): PollQueueMessageDescriptor {
  if (isBlockedByAnotherPoll(input.blockingSearchName, input.waitingForAnotherPoll)) {
    if (input.blockingSearchName) {
      return {
        messageCode: "POLL_QUEUE_QUEUED_BEHIND_NAMED",
        searchName: input.blockingSearchName,
        waitingPosition: input.waitingPosition,
      };
    }

    return {
      messageCode: "POLL_QUEUE_QUEUED_BEHIND_GENERIC",
      waitingPosition: input.waitingPosition,
    };
  }

  return { messageCode: "POLL_QUEUE_QUEUED" };
}

function resolveAlreadyQueuedMessage(input: PollQueueMessageInput): PollQueueMessageDescriptor {
  if (isBlockedByAnotherPoll(input.blockingSearchName, input.waitingForAnotherPoll)) {
    if (input.blockingSearchName) {
      return {
        messageCode: "POLL_QUEUE_ALREADY_QUEUED_BEHIND_NAMED",
        searchName: input.blockingSearchName,
      };
    }

    return { messageCode: "POLL_QUEUE_ALREADY_QUEUED_BEHIND_GENERIC" };
  }

  return { messageCode: "POLL_QUEUE_ALREADY_QUEUED" };
}

export function resolvePollQueueMessage(input: PollQueueMessageInput): PollQueueMessageDescriptor {
  if (input.queued) {
    return resolveQueuedMessage(input);
  }

  if (input.jobState === "active") {
    return { messageCode: "POLL_QUEUE_ALREADY_RUNNING" };
  }

  if (input.jobState === "waiting" || input.jobState === "delayed") {
    return resolveAlreadyQueuedMessage(input);
  }

  return { messageCode: "POLL_QUEUE_ALREADY_IN_PROGRESS" };
}

const englishMessages: Record<PollQueueMessageCode, (input: PollQueueMessageDescriptor) => string> = {
  POLL_QUEUE_QUEUED: () =>
    "Poll queued. The worker may take up to a minute to start, then results will appear shortly. Updating automatically.",
  POLL_QUEUE_QUEUED_BEHIND_NAMED: (input) => {
    const positionNote = formatEnglishPositionNote(input.waitingPosition);
    return `Poll queued — waiting for "${input.searchName}" to finish first (one poll at a time).${positionNote} Updating automatically.`;
  },
  POLL_QUEUE_QUEUED_BEHIND_GENERIC: (input) => {
    const positionNote = formatEnglishPositionNote(input.waitingPosition);
    return `Poll queued — waiting for another search to finish first (one poll at a time).${positionNote} Updating automatically.`;
  },
  POLL_QUEUE_ALREADY_RUNNING: () => "A poll is already running for this search.",
  POLL_QUEUE_ALREADY_QUEUED_BEHIND_NAMED: (input) =>
    `Poll already queued — waiting for "${input.searchName}" to finish first (one poll at a time).`,
  POLL_QUEUE_ALREADY_QUEUED_BEHIND_GENERIC: () =>
    "Poll already queued — waiting for another search to finish first (one poll at a time).",
  POLL_QUEUE_ALREADY_QUEUED: () =>
    "A poll is already queued. The worker may take up to a minute to start.",
  POLL_QUEUE_ALREADY_IN_PROGRESS: () => "A poll is already in progress for this search.",
};

function formatEnglishPositionNote(waitingPosition: number | undefined): string {
  if (waitingPosition == null || waitingPosition <= 1) {
    return "";
  }

  return ` You are #${waitingPosition} in line.`;
}

/** English fallback for logs and legacy callers. Prefer resolvePollQueueMessage + client i18n in the web app. */
export function formatPollQueueMessage(input: PollQueueMessageInput): string {
  const descriptor = resolvePollQueueMessage(input);
  return englishMessages[descriptor.messageCode](descriptor);
}
