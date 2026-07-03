"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { formatDateTime } from "@/lib/i18n";

export interface WorkerHeartbeatRecord {
  workerId: string;
  status: string;
  hostname: string | null;
  pid: number | null;
  startedAt: string;
  lastSeenAt: string;
  facebookSessionStatus: string | null;
  facebookSessionMode: string | null;
  facebookSessionMessage: string | null;
}

interface WorkerStatusCardProps {
  heartbeat: WorkerHeartbeatRecord | null;
}

const HEARTBEAT_STALE_MS = 90_000;

const statusStyles: Record<"online" | "stale" | "offline" | "missing", string> = {
  online:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  stale:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  offline:
    "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100",
  missing:
    "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100",
};

const dotStyles: Record<"online" | "stale" | "offline" | "missing", string> = {
  online: "bg-emerald-500",
  stale: "bg-amber-500",
  offline: "bg-slate-400",
  missing: "bg-blue-500",
};

export function WorkerStatusCard({ heartbeat }: WorkerStatusCardProps) {
  const locale = useLocale();
  const t = useTranslations();
  const state = getWorkerState(heartbeat);

  return (
    <section className={`mb-10 rounded-lg border p-4 ${statusStyles[state]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[state]}`} aria-hidden="true" />
            <h2 className="text-sm font-semibold">{t("workerStatusTitle")}</h2>
          </div>
          <p className="mt-2 text-sm">{getStatusText(state, t)}</p>
        </div>
        {heartbeat ? (
          <div className="text-left text-xs sm:text-right">
            <p>{t("workerStatusId", { id: heartbeat.workerId })}</p>
            <p className="mt-1 opacity-80">
              {t("workerStatusLastSeen", {
                date: formatDateTime(heartbeat.lastSeenAt, locale),
              })}
            </p>
          </div>
        ) : null}
      </div>

      {heartbeat ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">{t("workerStatusRuntime")}</dt>
            <dd className="opacity-80">
              {formatRuntime(heartbeat.hostname, heartbeat.pid)}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("workerStatusFacebookSession")}</dt>
            <dd className="opacity-80">
              {formatFacebookSession(heartbeat.facebookSessionStatus, heartbeat.facebookSessionMode)}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function getWorkerState(heartbeat: WorkerHeartbeatRecord | null): "online" | "stale" | "offline" | "missing" {
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

function getStatusText(state: "online" | "stale" | "offline" | "missing", t: ReturnType<typeof useTranslations>): string {
  switch (state) {
    case "online":
      return t("workerStatusOnline");
    case "stale":
      return t("workerStatusStale");
    case "offline":
      return t("workerStatusOffline");
    case "missing":
      return t("workerStatusMissing");
  }
}

function formatRuntime(hostname: string | null, pid: number | null): string {
  if (hostname && pid) {
    return `${hostname} - pid ${pid}`;
  }

  return hostname ?? "local worker";
}

function formatFacebookSession(status: string | null, mode: string | null): string {
  if (!status && !mode) {
    return "unknown";
  }

  return [status, mode].filter(Boolean).join(" / ");
}
