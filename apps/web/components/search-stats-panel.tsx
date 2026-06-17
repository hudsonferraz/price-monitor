"use client";

import { formatPriceCents } from "@/lib/i18n";
import { useLocale, useTranslations } from "@/components/locale-provider";
import type { SearchStatsSummary } from "@/lib/search-stats";

interface SearchStatsPanelProps {
  summaries: SearchStatsSummary[];
}

function ListingsTimeline({
  timeline,
}: {
  timeline: SearchStatsSummary["timeline"];
}) {
  const locale = useLocale();
  const t = useTranslations();
  const maxListings = Math.max(...timeline.map((point) => point.listingsFound), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--muted)]">{t("statsListingsOverTime")}</p>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
        {timeline.map((point) => {
          const heightPercent = Math.max((point.listingsFound / maxListings) * 100, 8);

          return (
            <div key={point.pollRunId} className="flex min-w-10 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-[var(--foreground)]">
                {point.listingsFound}
              </span>
              <div
                className="w-8 rounded-t bg-[var(--accent)]/80"
                style={{ height: `${heightPercent}px`, minHeight: "8px", maxHeight: "72px" }}
                title={`${formatShortDate(point.startedAt, locale)} · ${point.listingsFound}`}
              />
              <span className="text-[10px] text-[var(--muted)]">
                {formatShortDate(point.startedAt, locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatShortDate(value: string, locale: ReturnType<typeof useLocale>) {
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function SearchStatsCard({ summary }: { summary: SearchStatsSummary }) {
  const locale = useLocale();
  const t = useTranslations();
  const hasPriceData =
    summary.latestAveragePriceCents != null ||
    summary.lowestPriceCents != null ||
    summary.highestPriceCents != null;

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold">{summary.searchName}</h3>
        <span className="text-xs text-[var(--muted)]">
          {t("statsPollCount", { count: summary.successfulPollCount })}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--muted)]">{t("statsLatestAverage")}</dt>
          <dd className="mt-1 font-medium">
            {summary.latestAveragePriceCents != null
              ? formatPriceCents(summary.latestAveragePriceCents, locale)
              : t("statsNoPriceData")}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t("statsPriceRange")}</dt>
          <dd className="mt-1 font-medium">
            {hasPriceData
              ? `${formatPriceCents(summary.lowestPriceCents, locale)} – ${formatPriceCents(summary.highestPriceCents, locale)}`
              : t("statsNoPriceData")}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t("statsSuccessfulPolls")}</dt>
          <dd className="mt-1 font-medium">{summary.successfulPollCount}</dd>
        </div>
      </dl>

      {summary.timeline.length > 1 ? (
        <div className="mt-4">
          <ListingsTimeline timeline={summary.timeline} />
        </div>
      ) : null}
    </article>
  );
}

export function SearchStatsPanel({ summaries }: SearchStatsPanelProps) {
  const t = useTranslations();

  if (summaries.length === 0) {
    return (
      <section className="mb-10 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">{t("statsTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("statsEmpty")}</p>
      </section>
    );
  }

  return (
    <section className="mb-10 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">{t("statsTitle")}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t("statsDescription")}</p>
      <div className="mt-4 space-y-4">
        {summaries.map((summary) => (
          <SearchStatsCard key={summary.savedSearchId} summary={summary} />
        ))}
      </div>
    </section>
  );
}
