"use client";

import { useTranslations } from "@/components/locale-provider";
import type { WakeWorkerResult } from "@/lib/wake-worker";
import type { PollIssueCode } from "@price-monitor/shared/poll-errors";

type DiagnosticsKind = "worker" | PollIssueCode;

interface PollDiagnosticsPanelProps {
  workerWake: WakeWorkerResult;
  latestIssueCode: PollIssueCode | null;
  failedPollCount24h: number;
}

const alertStyles: Record<"warning" | "danger" | "info", string> = {
  danger:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  info:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100",
};

export function PollDiagnosticsPanel({
  workerWake,
  latestIssueCode,
  failedPollCount24h,
}: PollDiagnosticsPanelProps) {
  const t = useTranslations();
  const kind = getDiagnosticsKind(workerWake, latestIssueCode);

  if (!kind) {
    return null;
  }

  const detail = getWorkerWakeDetail(workerWake);
  const severity = kind === "worker" || isFacebookAuthKind(kind) ? "danger" : "warning";

  return (
    <section className={`mb-10 rounded-lg border p-4 ${alertStyles[severity]}`} role="alert">
      <h2 className="text-sm font-semibold">{getTitle(kind, t)}</h2>
      <p className="mt-2 text-sm">
        {getDescription(kind, t, {
          detail,
          failedPolls: failedPollCount24h,
        })}
      </p>
      {isFacebookAuthKind(kind) ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>{t("facebookSessionStep1")}</li>
          <li>{t("facebookSessionStep2")}</li>
          <li>{t("facebookSessionStep3")}</li>
          <li>{t("facebookSessionStep4")}</li>
        </ol>
      ) : null}
      <p className="mt-3 text-sm">
        <a
          href="https://github.com/hudsonferraz/price-monitor/blob/main/docs/render-deploy.md#troubleshooting"
          className="font-medium underline"
          target="_blank"
          rel="noreferrer"
        >
          {t("diagnosticsDocs")}
        </a>
      </p>
    </section>
  );
}

function getDiagnosticsKind(
  workerWake: WakeWorkerResult,
  latestIssueCode: PollIssueCode | null,
): DiagnosticsKind | null {
  if (!workerWake.skipped && !workerWake.ok) {
    return "worker";
  }

  return latestIssueCode;
}

function isFacebookAuthKind(kind: DiagnosticsKind): boolean {
  return kind === "FACEBOOK_SESSION" || kind === "FACEBOOK_CHECKPOINT";
}

function getWorkerWakeDetail(workerWake: WakeWorkerResult): string {
  if (workerWake.skipped) {
    return "WORKER_HEALTH_URL not configured";
  }

  if (workerWake.status) {
    return `HTTP ${workerWake.status}`;
  }

  return workerWake.error ?? "timeout";
}

function getTitle(kind: DiagnosticsKind, t: ReturnType<typeof useTranslations>): string {
  switch (kind) {
    case "worker":
      return t("diagnosticsWorkerTitle");
    case "FACEBOOK_CHECKPOINT":
      return t("diagnosticsCheckpointTitle");
    case "FACEBOOK_SESSION":
      return t("diagnosticsSessionTitle");
    case "NO_LISTINGS":
      return t("diagnosticsNoListingsTitle");
    case "POLL_TIMEOUT":
      return t("diagnosticsTimeoutTitle");
    default:
      return t("diagnosticsUnknownTitle");
  }
}

function getDescription(
  kind: DiagnosticsKind,
  t: ReturnType<typeof useTranslations>,
  values: { detail: string; failedPolls: number },
): string {
  switch (kind) {
    case "worker":
      return t("diagnosticsWorkerDescription", values);
    case "FACEBOOK_CHECKPOINT":
      return t("diagnosticsCheckpointDescription", values);
    case "FACEBOOK_SESSION":
      return t("diagnosticsSessionDescription", values);
    case "NO_LISTINGS":
      return t("diagnosticsNoListingsDescription", values);
    case "POLL_TIMEOUT":
      return t("diagnosticsTimeoutDescription", values);
    default:
      return t("diagnosticsUnknownDescription", values);
  }
}
