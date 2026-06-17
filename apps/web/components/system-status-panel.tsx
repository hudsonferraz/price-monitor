import { formatAveragePollDuration } from "@/lib/system-health";
import { formatDurationMs } from "@price-monitor/shared/poll-errors";

interface SystemStatusPanelProps {
  workerOnline: boolean | null;
  workerLatencyMs: number | null;
  workerConfigured: boolean;
  failedPollCount24h: number;
  averagePollDurationMs: number | null;
}

export function SystemStatusPanel({
  workerOnline,
  workerLatencyMs,
  workerConfigured,
  failedPollCount24h,
  averagePollDurationMs,
}: SystemStatusPanelProps) {
  if (!workerConfigured && failedPollCount24h === 0 && averagePollDurationMs == null) {
    return null;
  }

  const workerStatusLabel =
    workerOnline == null ? "Not configured" : workerOnline ? "Online" : "Offline or waking up";
  const workerStatusClass =
    workerOnline == null
      ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      : workerOnline
        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";

  return (
    <section className="mb-10 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-sm font-semibold">System status</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--muted)]">Worker</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${workerStatusClass}`}>
              {workerStatusLabel}
            </span>
            {workerOnline && workerLatencyMs != null ? (
              <span className="text-xs text-[var(--muted)]">{formatDurationMs(workerLatencyMs)} response</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Failed polls (24h)</dt>
          <dd className="mt-1 font-medium">{failedPollCount24h}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Avg successful poll</dt>
          <dd className="mt-1 font-medium">{formatAveragePollDuration(averagePollDurationMs)}</dd>
        </div>
      </dl>
      {workerOnline === false ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          On Render free tier the worker sleeps after inactivity. The first poll after wake-up can
          take 1–2 minutes.
        </p>
      ) : null}
    </section>
  );
}
