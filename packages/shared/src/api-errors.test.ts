import { describe, expect, it } from "vitest";
import { createApiErrorBody, type ApiErrorCode } from "./api-errors";

describe("createApiErrorBody", () => {
  it("returns an errorCode payload", () => {
    expect(createApiErrorBody("UNAUTHORIZED")).toEqual({ errorCode: "UNAUTHORIZED" });
  });

  it("merges extra fields for structured errors", () => {
    const body = createApiErrorBody("POLL_COOLDOWN", {
      remainingMinutes: 12,
      retryAfterSeconds: 720,
    });

    expect(body).toEqual({
      errorCode: "POLL_COOLDOWN",
      remainingMinutes: 12,
      retryAfterSeconds: 720,
    });
  });

  it("covers all defined error codes", () => {
    // Record keyed by ApiErrorCode: the compiler fails if a code is missing or stale.
    const allCodes: Record<ApiErrorCode, true> = {
      UNAUTHORIZED: true,
      SEARCH_NOT_FOUND: true,
      SEARCH_ID_REQUIRED: true,
      SEARCH_DISABLED: true,
      SEARCH_DELETE_ACTIVE_POLL: true,
      SEARCH_DELETE_CANCEL_FAILED: true,
      ALERT_NOT_FOUND: true,
      USER_NOT_FOUND: true,
      VALIDATION_FAILED: true,
      NO_PREFERENCE_FIELDS: true,
      INVALID_PREFERRED_LOCALE: true,
      REDIS_NOT_CONFIGURED: true,
      POLL_QUEUE_FAILED: true,
      POLL_COOLDOWN: true,
      WORKER_OFFLINE: true,
      WORKER_STALE: true,
      TELEGRAM_NOT_CONFIGURED: true,
      TELEGRAM_NOT_CONNECTED: true,
    };
    const codes = Object.keys(allCodes) as ApiErrorCode[];

    for (const errorCode of codes) {
      expect(createApiErrorBody(errorCode).errorCode).toBe(errorCode);
    }
  });
});
