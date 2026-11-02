"use client";

import {
  getWorkerState,
  HEARTBEAT_STALE_MS,
  type WorkerHeartbeatSnapshot,
  type WorkerState,
} from "@price-monitor/shared/worker-health";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const WORKER_HEARTBEAT_REFRESH_MS = 30_000;
export const WORKER_STATUS_TICK_MS = 10_000;

export function useWorkerState(heartbeat: WorkerHeartbeatSnapshot | null): WorkerState {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, WORKER_STATUS_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const heartbeatLastSeenAt = heartbeat?.lastSeenAt;
  const heartbeatStatus = heartbeat?.status;

  useEffect(() => {
    if (!heartbeatLastSeenAt || heartbeatStatus === "OFFLINE") {
      return;
    }

    const lastSeenMs = new Date(heartbeatLastSeenAt).getTime();
    if (!Number.isFinite(lastSeenMs)) {
      return;
    }

    const staleInMs = lastSeenMs + HEARTBEAT_STALE_MS - Date.now();
    if (staleInMs <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setNowMs(Date.now());
    }, staleInMs + 50);

    return () => clearTimeout(timeout);
  }, [heartbeatLastSeenAt, heartbeatStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, WORKER_HEARTBEAT_REFRESH_MS);

    return () => clearInterval(interval);
  }, [router]);

  return getWorkerState(heartbeat, nowMs);
}
