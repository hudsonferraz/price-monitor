"use client";

import { useTranslations } from "@/components/locale-provider";

export type PollPhase = "queuing" | "queued" | "running" | "success" | "failed";

export interface SearchPollState {
  phase: PollPhase;
  message: string;
}

const phaseStyles: Record<PollPhase, string> = {
  queuing:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
  queued:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
  running:
    "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200",
  success:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200",
  failed: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
};

interface PollStatusBannerProps {
  pollState: SearchPollState;
}

export function PollStatusBanner({ pollState }: PollStatusBannerProps) {
  const t = useTranslations();

  const labelByPhase: Record<PollPhase, string> = {
    queuing: t("pollStatusQueuing"),
    queued: t("pollStatusQueued"),
    running: t("pollStatusRunning"),
    success: t("pollStatusSuccess"),
    failed: t("pollStatusFailed"),
  };

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${phaseStyles[pollState.phase]}`}>
      <span className="font-medium">{labelByPhase[pollState.phase]}:</span> {pollState.message}
    </div>
  );
}
