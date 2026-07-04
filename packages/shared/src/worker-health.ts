export const HEARTBEAT_STALE_MS = 90_000;

export type WorkerHeartbeatStatus = "ONLINE" | "OFFLINE";

export type WorkerState = "online" | "stale" | "offline" | "missing";

export interface WorkerHeartbeatSnapshot {
  status: WorkerHeartbeatStatus;
  lastSeenAt: string;
}

export function getWorkerState(heartbeat: WorkerHeartbeatSnapshot | null): WorkerState {
  if (!heartbeat) {
    return "missing";
  }

  if (heartbeat.status === "OFFLINE") {
    return "offline";
  }

  const lastSeenAt = new Date(heartbeat.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenAt) || Date.now() - lastSeenAt > HEARTBEAT_STALE_MS) {
    return "stale";
  }

  return "online";
}

export function isWorkerAvailableForPolling(heartbeat: WorkerHeartbeatSnapshot | null): boolean {
  return getWorkerState(heartbeat) === "online";
}
