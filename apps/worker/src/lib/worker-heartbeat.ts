import os from "node:os";
import { WorkerHeartbeatStatus, prisma } from "@price-monitor/database";
import { getFacebookSessionDiagnostics } from "./facebook-session";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export interface WorkerHeartbeatHandle {
  workerId: string;
  stop: () => void;
}

export function getWorkerId(): string {
  return process.env.WORKER_ID?.trim() || `local-${os.hostname()}`;
}

export async function upsertWorkerHeartbeat(startedAt: Date, workerId = getWorkerId()): Promise<void> {
  const facebookSession = getFacebookSessionDiagnostics();
  const now = new Date();
  const data = {
    status: WorkerHeartbeatStatus.ONLINE,
    hostname: os.hostname(),
    pid: process.pid,
    startedAt,
    lastSeenAt: now,
    facebookSessionStatus: facebookSession.status,
    facebookSessionMode: facebookSession.mode,
    facebookSessionPath: facebookSession.path,
    facebookSessionMessage: facebookSession.message,
  };

  await prisma.workerHeartbeat.upsert({
    where: { workerId },
    create: { workerId, ...data },
    update: data,
  });
}

export async function markWorkerOffline(workerId = getWorkerId()): Promise<void> {
  await prisma.workerHeartbeat.updateMany({
    where: { workerId },
    data: { status: WorkerHeartbeatStatus.OFFLINE, lastSeenAt: new Date() },
  });
}

export function startWorkerHeartbeat(
  startedAt = new Date(),
  intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
): WorkerHeartbeatHandle {
  const workerId = getWorkerId();

  void upsertWorkerHeartbeat(startedAt, workerId).catch((error: unknown) => {
    console.warn("Failed to write worker heartbeat:", getErrorMessage(error));
  });

  const interval = setInterval(() => {
    void upsertWorkerHeartbeat(startedAt, workerId).catch((error: unknown) => {
      console.warn("Failed to write worker heartbeat:", getErrorMessage(error));
    });
  }, intervalMs);

  interval.unref?.();

  return {
    workerId,
    stop: () => clearInterval(interval),
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
