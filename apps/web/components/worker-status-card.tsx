"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { formatDateTime } from "@/lib/i18n";
import type { AppLocale } from "@/lib/i18n/locales";
import { useWorkerState } from "@/lib/use-worker-state";
import { formatDurationMs, type PollIssueCode } from "@price-monitor/shared/poll-errors";
import {
  getWorkerState,
  HEARTBEAT_STALE_MS,
  type WorkerState,
} from "@price-monitor/shared/worker-health";

export { getWorkerState, HEARTBEAT_STALE_MS };
export type { WorkerState };

export interface WorkerHeartbeatRecord {
  workerId: string;
  status: "ONLINE" | "OFFLINE";
  hostname: string | null;
  pid: number | null;
  startedAt: string;
  lastSeenAt: string;
  facebookSessionStatus: string | null;
  facebookSessionMode: string | null;
  facebookSessionMessage: string | null;
}

export interface WorkerActivitySummary {
  latestSuccess: {
    startedAt: string;
    listingsFound: number;
    newAlerts: number;
    durationMs: number | null;
  } | null;
  latestFailure: {
    startedAt: string;
    issueCode: PollIssueCode | null;
    errorMessage: string | null;
  } | null;
  failedPollCount24h: number;
  averageDurationMs: number | null;
}

interface WorkerStatusCardProps {
  heartbeat: WorkerHeartbeatRecord | null;
  activity: WorkerActivitySummary;
}

const statusStyles: Record<WorkerState, string> = {
  online:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  stale:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  offline:
    "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100",
  missing:
    "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100",
};

const dotStyles: Record<WorkerState, string> = {
  online: "bg-emerald-500",
  stale: "bg-amber-500",
  offline: "bg-slate-400",
  missing: "bg-blue-500",
};

export function WorkerStatusCard({ heartbeat, activity }: WorkerStatusCardProps) {
  const locale = useLocale();
  const t = useTranslations();
  const state = useWorkerState(
    heartbeat ? { status: heartbeat.status, lastSeenAt: heartbeat.lastSeenAt } : null,
  );

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

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {heartbeat ? (
          <>
            <div>
              <dt className="font-medium">{t("workerStatusRuntime")}</dt>
              <dd className="opacity-80">{formatRuntime(heartbeat.hostname, heartbeat.pid)}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("workerStatusFacebookSession")}</dt>
              <dd className="opacity-80">
                {formatFacebookSession(
                  heartbeat.facebookSessionStatus,
                  heartbeat.facebookSessionMode,
                  t,
                )}
              </dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="font-medium">{t("workerStatusLastSuccess")}</dt>
          <dd className="opacity-80">{formatLatestSuccess(activity.latestSuccess, locale, t)}</dd>
        </div>
        <div>
          <dt className="font-medium">{t("workerStatusLastFailure")}</dt>
          <dd className="opacity-80">{formatLatestFailure(activity, locale, t)}</dd>
        </div>
      </dl>
    </section>
  );
}

function getStatusText(state: WorkerState, t: ReturnType<typeof useTranslations>): string {
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

function formatFacebookSession(
  status: string | null,
  mode: string | null,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!status && !mode) {
    return t("workerFacebookSessionUnknown");
  }

  const statusLabel = status ? translateFacebookSessionStatus(status, t) : null;
  const modeLabel = mode ? translateFacebookSessionMode(mode, t) : null;
  return [statusLabel, modeLabel].filter(Boolean).join(" / ");
}

function translateFacebookSessionStatus(
  status: string,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case "ok":
      return t("workerFacebookSessionOk");
    case "needs_login":
      return t("workerFacebookSessionNeedsLogin");
    case "unverified":
      return t("workerFacebookSessionUnverified");
    case "not_configured":
      return t("workerFacebookSessionNotConfigured");
    default:
      return status;
  }
}

function translateFacebookSessionMode(
  mode: string,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (mode) {
    case "browser_profile":
      return t("workerFacebookSessionModeProfile");
    case "none":
      return t("workerFacebookSessionModeNone");
    default:
      return mode;
  }
}

function formatLatestSuccess(
  latestSuccess: WorkerActivitySummary["latestSuccess"],
  locale: AppLocale,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!latestSuccess) {
    return t("workerStatusNoSuccess");
  }

  const duration = latestSuccess.durationMs != null ? ` - ${formatDurationMs(latestSuccess.durationMs)}` : "";
  return t("workerStatusSuccessSummary", {
    date: formatDateTime(latestSuccess.startedAt, locale),
    listings: latestSuccess.listingsFound,
    alerts: latestSuccess.newAlerts,
    duration,
  });
}

function formatLatestFailure(
  activity: WorkerActivitySummary,
  locale: AppLocale,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!activity.latestFailure) {
    return t("workerStatusNoFailure");
  }

  return t("workerStatusFailureSummary", {
    date: formatDateTime(activity.latestFailure.startedAt, locale),
    issue: formatIssueCode(activity.latestFailure.issueCode, t),
    failedPolls: activity.failedPollCount24h,
  });
}

function formatIssueCode(issueCode: PollIssueCode | null, t: ReturnType<typeof useTranslations>): string {
  switch (issueCode) {
    case "FACEBOOK_CHECKPOINT":
      return t("diagnosticsCheckpointTitle");
    case "FACEBOOK_SESSION":
      return t("diagnosticsSessionTitle");
    case "NO_LISTINGS":
      return t("diagnosticsNoListingsTitle");
    case "POLL_TIMEOUT":
      return t("diagnosticsTimeoutTitle");
    case "UNKNOWN":
    default:
      return t("diagnosticsUnknownTitle");
  }
}
