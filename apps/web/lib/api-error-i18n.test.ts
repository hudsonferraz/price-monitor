import { describe, expect, it } from "vitest";
import { messages } from "@/lib/i18n/messages/en-US";
import { getApiErrorMessageKey, translateApiError } from "./api-error-i18n";

const translate = (key: keyof typeof messages, params?: Record<string, string | number>) => {
  const template = messages[key];
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [name, value]) => result.replace(`{${name}}`, String(value)),
    template,
  );
};

describe("getApiErrorMessageKey", () => {
  it("maps known API error codes to message keys", () => {
    expect(getApiErrorMessageKey("UNAUTHORIZED")).toBe("apiErrorUnauthorized");
    expect(getApiErrorMessageKey("SEARCH_NOT_FOUND")).toBe("apiErrorSearchNotFound");
    expect(getApiErrorMessageKey("POLL_COOLDOWN")).toBe("pollCooldown");
  });

  it("returns null for unknown codes", () => {
    expect(getApiErrorMessageKey("NOT_A_REAL_CODE")).toBeNull();
  });
});

describe("translateApiError", () => {
  it("translates standard API errors", () => {
    expect(translateApiError("SEARCH_DISABLED", translate)).toBe(messages.apiErrorSearchDisabled);
  });

  it("translates poll cooldown with remaining minutes", () => {
    expect(translateApiError("POLL_COOLDOWN", translate, { remainingMinutes: 3 })).toBe(
      messages.pollCooldown.replace("{minutes}", "3"),
    );
  });

  it("translates worker availability errors with the worker:dev command", () => {
    expect(translateApiError("WORKER_OFFLINE", translate)).toContain("npm run worker:dev");
    expect(translateApiError("WORKER_STALE", translate)).toContain("npm run worker:dev");
    expect(translateApiError("WORKER_OFFLINE", translate)).toBe(messages.apiErrorWorkerOffline);
    expect(translateApiError("WORKER_STALE", translate)).toBe(messages.apiErrorWorkerStale);
  });

  it("falls back to unknown for missing codes", () => {
    expect(translateApiError(undefined, translate)).toBe(messages.apiErrorUnknown);
  });
});
