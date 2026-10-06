"use client";

import { useTranslations } from "@/components/locale-provider";
import type { PollIssueCode } from "@price-monitor/shared/poll-errors";

type DiagnosticsKind = PollIssueCode;

interface PollDiagnosticsPanelProps {
  latestIssueCode: PollIssueCode | null;
  failedPollCount24h: number;
}

const alertStyles: Record<"warning" | "danger", string> = {
  danger:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
};

export function PollDiagnosticsPanel({
  latestIssueCode,
  failedPollCount24h,
}: PollDiagnosticsPanelProps) {
  const t = useTranslations();
  const kind = latestIssueCode;

  if (!kind) {
    return null;
  }

  const severity = isFacebookAuthKind(kind) ? "danger" : "warning";

  return (
    <section className={`mb-10 rounded-lg border p-4 ${alertStyles[severity]}`} role="alert">
      <h2 className="text-sm font-semibold">{getTitle(kind, t)}</h2>
      <p className="mt-2 text-sm">
        {getDescription(kind, t, {
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
    </section>
  );
}

function isFacebookAuthKind(kind: DiagnosticsKind): boolean {
  return kind === "FACEBOOK_SESSION" || kind === "FACEBOOK_CHECKPOINT";
}

function getTitle(kind: DiagnosticsKind, t: ReturnType<typeof useTranslations>): string {
  switch (kind) {
    case "FACEBOOK_CHECKPOINT":
      return t("diagnosticsCheckpointTitle");
    case "FACEBOOK_SESSION":
      return t("diagnosticsSessionTitle");
    case "PARSE_EMPTY":
      return t("diagnosticsParseEmptyTitle");
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
  values: { failedPolls: number },
): string {
  switch (kind) {
    case "FACEBOOK_CHECKPOINT":
      return t("diagnosticsCheckpointDescription", values);
    case "FACEBOOK_SESSION":
      return t("diagnosticsSessionDescription", values);
    case "PARSE_EMPTY":
      return t("diagnosticsParseEmptyDescription", values);
    case "NO_LISTINGS":
      return t("diagnosticsNoListingsDescription", values);
    case "POLL_TIMEOUT":
      return t("diagnosticsTimeoutDescription", values);
    default:
      return t("diagnosticsUnknownDescription", values);
  }
}