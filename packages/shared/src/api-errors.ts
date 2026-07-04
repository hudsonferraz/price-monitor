export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "SEARCH_NOT_FOUND"
  | "SEARCH_ID_REQUIRED"
  | "SEARCH_DISABLED"
  | "SEARCH_DELETE_ACTIVE_POLL"
  | "SEARCH_DELETE_CANCEL_FAILED"
  | "ALERT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "NO_PREFERENCE_FIELDS"
  | "INVALID_PREFERRED_LOCALE"
  | "REDIS_NOT_CONFIGURED"
  | "POLL_QUEUE_FAILED"
  | "POLL_COOLDOWN"
  | "WORKER_OFFLINE"
  | "WORKER_STALE";

export function createApiErrorBody(
  errorCode: ApiErrorCode,
  extra?: Record<string, unknown>,
): { errorCode: ApiErrorCode } & Record<string, unknown> {
  return { errorCode, ...extra };
}
