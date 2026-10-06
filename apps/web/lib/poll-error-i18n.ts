import type { MessageKey } from "@/lib/i18n/messages/en-US";
import { getPollIssueCode } from "@price-monitor/shared/poll-errors";

export function getPollErrorMessageKey(errorMessage: string | null | undefined): MessageKey {
  const issueCode = getPollIssueCode(errorMessage);

  switch (issueCode) {
    case "FACEBOOK_CHECKPOINT":
      return "pollErrorCheckpoint";
    case "BROWSER_PROFILE_LOCKED":
      return "pollErrorBrowserProfileLocked";
    case "FACEBOOK_SESSION":
      return "pollErrorSession";
    case "PARSE_EMPTY":
      return "pollErrorParseEmpty";
    case "NO_LISTINGS":
      return "pollErrorNoListings";
    case "POLL_TIMEOUT":
      return "pollErrorTimeout";
    case "UNKNOWN":
    default:
      return "pollErrorUnknown";
  }
}

export function translatePollError(
  errorMessage: string | null | undefined,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  const issueCode = getPollIssueCode(errorMessage);

  if (issueCode === "UNKNOWN" && errorMessage) {
    return errorMessage;
  }

  return translate(getPollErrorMessageKey(errorMessage));
}
