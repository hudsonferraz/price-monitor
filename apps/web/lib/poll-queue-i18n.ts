import type { MessageKey } from "@/lib/i18n/messages/en-US";
import type {
  PollQueueMessageCode,
  PollQueueMessageDescriptor,
} from "@price-monitor/shared/poll-queue-messages";

const pollQueueMessageKeys: Record<PollQueueMessageCode, MessageKey> = {
  POLL_QUEUE_QUEUED: "pollQueueQueued",
  POLL_QUEUE_QUEUED_BEHIND_NAMED: "pollQueueQueuedBehindNamed",
  POLL_QUEUE_QUEUED_BEHIND_GENERIC: "pollQueueQueuedBehindGeneric",
  POLL_QUEUE_ALREADY_RUNNING: "pollQueueAlreadyRunning",
  POLL_QUEUE_ALREADY_QUEUED_BEHIND_NAMED: "pollQueueAlreadyQueuedBehindNamed",
  POLL_QUEUE_ALREADY_QUEUED_BEHIND_GENERIC: "pollQueueAlreadyQueuedBehindGeneric",
  POLL_QUEUE_ALREADY_QUEUED: "pollQueueAlreadyQueued",
  POLL_QUEUE_ALREADY_IN_PROGRESS: "pollQueueAlreadyInProgress",
};

export interface PollQueueMessageResponse {
  messageCode?: PollQueueMessageCode | string;
  searchName?: string;
  waitingPosition?: number;
}

function formatPositionNote(
  waitingPosition: number | undefined,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  if (waitingPosition == null || waitingPosition <= 1) {
    return "";
  }

  return translate("pollQueuePositionNote", { position: waitingPosition });
}

export function translatePollQueueMessage(
  response: PollQueueMessageResponse | PollQueueMessageDescriptor | null | undefined,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  if (!response?.messageCode) {
    return translate("pollStatusQueuedAuto");
  }

  const messageCode = response.messageCode as PollQueueMessageCode;
  const messageKey = pollQueueMessageKeys[messageCode];
  if (!messageKey) {
    return translate("pollStatusQueuedAuto");
  }

  const positionNote = formatPositionNote(response.waitingPosition, translate);

  if (messageCode === "POLL_QUEUE_QUEUED_BEHIND_NAMED") {
    if (response.searchName) {
      return translate(messageKey, { searchName: response.searchName, positionNote });
    }
    return translate("pollQueueQueuedBehindGeneric", { positionNote });
  }

  if (messageCode === "POLL_QUEUE_ALREADY_QUEUED_BEHIND_NAMED") {
    if (response.searchName) {
      return translate(messageKey, { searchName: response.searchName });
    }
    return translate("pollQueueAlreadyQueuedBehindGeneric");
  }

  if (
    messageCode === "POLL_QUEUE_QUEUED_BEHIND_GENERIC" ||
    messageCode === "POLL_QUEUE_QUEUED"
  ) {
    return translate(messageKey, { positionNote });
  }

  return translate(messageKey);
}
