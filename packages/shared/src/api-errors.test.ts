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
    const codes: ApiErrorCode[] = [
      "UNAUTHORIZED",
      "SEARCH_NOT_FOUND",
      "SEARCH_ID_REQUIRED",
      "SEARCH_DISABLED",
      "SEARCH_DELETE_ACTIVE_POLL",
      "SEARCH_DELETE_CANCEL_FAILED",
      "ALERT_NOT_FOUND",
      "USER_NOT_FOUND",
      "VALIDATION_FAILED",
      "NO_PREFERENCE_FIELDS",
      "EMAIL_NOTIFICATIONS_NOT_BOOLEAN",
      "INVALID_PREFERRED_LOCALE",
      "REDIS_NOT_CONFIGURED",
      "POLL_QUEUE_FAILED",
      "POLL_COOLDOWN",
    ];

    for (const errorCode of codes) {
      expect(createApiErrorBody(errorCode).errorCode).toBe(errorCode);
    }
  });
});
