import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkerState,
  HEARTBEAT_STALE_MS,
  isWorkerAvailableForPolling,
} from "./worker-health";

describe("getWorkerState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns missing when no heartbeat exists", () => {
    expect(getWorkerState(null)).toBe("missing");
  });

  it("returns offline when the worker reported a clean shutdown", () => {
    expect(
      getWorkerState({
        status: "OFFLINE",
        lastSeenAt: new Date().toISOString(),
      }),
    ).toBe("offline");
  });

  it("returns stale when the last heartbeat is too old", () => {
    const staleLastSeenAt = new Date(Date.now() - HEARTBEAT_STALE_MS - 1).toISOString();

    expect(
      getWorkerState({
        status: "ONLINE",
        lastSeenAt: staleLastSeenAt,
      }),
    ).toBe("stale");
  });

  it("returns online for a recent heartbeat", () => {
    expect(
      getWorkerState({
        status: "ONLINE",
        lastSeenAt: new Date().toISOString(),
      }),
    ).toBe("online");
  });
});

describe("isWorkerAvailableForPolling", () => {
  it("is true only for an online worker", () => {
    expect(isWorkerAvailableForPolling(null)).toBe(false);
    expect(
      isWorkerAvailableForPolling({
        status: "OFFLINE",
        lastSeenAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(
      isWorkerAvailableForPolling({
        status: "ONLINE",
        lastSeenAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });
});
