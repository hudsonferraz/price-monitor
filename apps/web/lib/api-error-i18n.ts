import type { ApiErrorCode } from "@price-monitor/shared/api-errors";
import type { MessageKey } from "@/lib/i18n/messages/en-US";

const apiErrorMessageKeys: Record<ApiErrorCode, MessageKey> = {
  UNAUTHORIZED: "apiErrorUnauthorized",
  SEARCH_NOT_FOUND: "apiErrorSearchNotFound",
  SEARCH_ID_REQUIRED: "apiErrorSearchIdRequired",
  SEARCH_DISABLED: "apiErrorSearchDisabled",
  SEARCH_DELETE_ACTIVE_POLL: "apiErrorSearchDeleteActivePoll",
  SEARCH_DELETE_CANCEL_FAILED: "apiErrorSearchDeleteCancelFailed",
  ALERT_NOT_FOUND: "apiErrorAlertNotFound",
  USER_NOT_FOUND: "apiErrorUserNotFound",
  VALIDATION_FAILED: "apiErrorValidationFailed",
  NO_PREFERENCE_FIELDS: "apiErrorNoPreferenceFields",
  EMAIL_NOTIFICATIONS_NOT_BOOLEAN: "apiErrorEmailNotificationsNotBoolean",
  INVALID_PREFERRED_LOCALE: "apiErrorInvalidPreferredLocale",
  REDIS_NOT_CONFIGURED: "apiErrorRedisNotConfigured",
  POLL_QUEUE_FAILED: "apiErrorPollQueueFailed",
  POLL_COOLDOWN: "pollCooldown",
};

export function getApiErrorMessageKey(errorCode: string | undefined): MessageKey | null {
  if (!errorCode) {
    return null;
  }

  return apiErrorMessageKeys[errorCode as ApiErrorCode] ?? null;
}

export function translateApiError(
  errorCode: string | undefined,
  translate: (key: MessageKey, params?: Record<string, string | number>) => string,
  params?: Record<string, number>,
): string {
  if (errorCode === "POLL_COOLDOWN" && params?.remainingMinutes != null) {
    return translate("pollCooldown", { minutes: params.remainingMinutes });
  }

  const messageKey = getApiErrorMessageKey(errorCode);
  if (messageKey) {
    return translate(messageKey);
  }

  return translate("apiErrorUnknown");
}
