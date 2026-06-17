import { formatDurationMs, formatPollErrorForDisplay } from "@price-monitor/shared/poll-errors";

export interface PollRunRecord {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  listingsFound: number;
  newAlerts: number;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface PollRunHistoryProps {
  pollRuns: PollRunRecord[];
}

const statusStyles: Record<PollRunRecord["status"], string> = {
  PENDING: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  RUNNING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function PollRunHistory({ pollRuns }: PollRunHistoryProps) {
  if (pollRuns.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Recent polls
      </p>
      <ul className="space-y-2">
        {pollRuns.slice(0, 3).map((run) => (
          <li key={run.id} className="rounded-md bg-[var(--background)] px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 font-medium ${statusStyles[run.status]}`}>
                {run.status}
              </span>
              <span className="text-[var(--muted)]">
                {new Date(run.startedAt).toLocaleString("pt-BR")}
              </span>
            </div>
            {run.status === "SUCCESS" ? (
              <p className="mt-1 text-[var(--muted)]">
                {run.listingsFound} listings · {run.newAlerts} new alert(s)
                {run.durationMs != null ? ` · ${formatDurationMs(run.durationMs)}` : ""}
              </p>
            ) : null}
            {run.status === "RUNNING" ? (
              <p className="mt-1 text-[var(--muted)]">
                Checking Facebook Marketplace — usually takes 1–2 minutes.
              </p>
            ) : null}
            {run.status === "FAILED" && run.errorMessage ? (
              <p className="mt-1 text-red-600">{formatPollErrorForDisplay(run.errorMessage)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
