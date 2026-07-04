import { prisma } from "@price-monitor/database";
import {
  getWorkerState,
  type WorkerHeartbeatSnapshot,
  type WorkerState,
} from "@price-monitor/shared/worker-health";

export async function getLatestWorkerHeartbeatSnapshot(): Promise<WorkerHeartbeatSnapshot | null> {
  const heartbeat = await prisma.workerHeartbeat.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: {
      status: true,
      lastSeenAt: true,
    },
  });

  if (!heartbeat) {
    return null;
  }

  return {
    status: heartbeat.status,
    lastSeenAt: heartbeat.lastSeenAt.toISOString(),
  };
}

export async function getLatestWorkerState(): Promise<WorkerState> {
  return getWorkerState(await getLatestWorkerHeartbeatSnapshot());
}
