"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import {
  DIRECTION_CLASS,
  formatChangeCents,
  formatChangePercent,
  PriceLineChart,
} from "@/components/price-line-chart";
import { formatDateTime, formatPriceCents, formatShortDate } from "@/lib/i18n";
import { DEAL_QUALITY_HISTORY_DAYS } from "@price-monitor/shared/deal-quality";
import {
  getSparklineGeometry,
  type PricePoint,
  summarizePriceSeries,
} from "@price-monitor/shared/price-history";

const SPARKLINE_BOX = { width: 120, height: 36, padding: 4 };

interface PriceTrendProps {
  searchId: string;
  listingId: string;
  listingTitle: string;
  /** Downsampled series for the card. */
  points: PricePoint[];
  /** Size of the full series. */
  totalCount: number;
}

/** Compact price trend on a listing card; opens the full history in a dialog. */
export function PriceTrend({ searchId, listingId, listingTitle, points, totalCount }: PriceTrendProps) {
  const locale = useLocale();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const summary = summarizePriceSeries(points);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  if (!summary) {
    return null;
  }

  const { path, coordinates } = getSparklineGeometry(points, SPARKLINE_BOX);
  const last = coordinates[coordinates.length - 1];
  const changeLabel =
    summary.direction === "flat"
      ? t("priceHistoryUnchanged")
      : formatChangePercent(summary.changePercent, locale) ?? formatChangeCents(summary.changeCents, locale);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("priceHistoryTrendLabel", {
          count: Math.max(totalCount, summary.count),
          first: formatPriceCents(summary.first.priceCents, locale),
          latest: formatPriceCents(summary.latest.priceCents, locale),
          lowest: formatPriceCents(summary.lowest.priceCents, locale),
        })}
        className={`group flex w-full items-center gap-2 rounded-md border border-transparent px-1 py-1 text-left hover:border-[var(--border)] hover:bg-[var(--card)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:w-36 sm:shrink-0 sm:flex-col sm:items-stretch sm:self-center ${DIRECTION_CLASS[summary.direction]}`}
      >
        <svg
          viewBox={`0 0 ${SPARKLINE_BOX.width} ${SPARKLINE_BOX.height}`}
          className="h-9 w-28 shrink-0 overflow-visible sm:w-full"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={last.x} cy={last.y} r={3} fill="currentColor" />
        </svg>
        <span className="text-xs font-medium tabular-nums sm:text-center" aria-hidden="true">
          {changeLabel}
        </span>
      </button>
      {isOpen ? (
        <PriceHistoryDialog
          searchId={searchId}
          listingId={listingId}
          listingTitle={listingTitle}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; points: PricePoint[] };

interface PriceHistoryDialogProps {
  searchId: string;
  listingId: string;
  listingTitle: string;
  onClose: () => void;
}

function PriceHistoryDialog({ searchId, listingId, listingTitle, onClose }: PriceHistoryDialogProps) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/searches/${encodeURIComponent(searchId)}/listings/${encodeURIComponent(listingId)}/price-history`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const body = (await response.json()) as { points: PricePoint[] };
        if (!cancelled) {
          setState({ status: "ready", points: body.points });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchId, listingId, attempt]);

  const titleId = `price-history-title-${listingId}`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Clicks on the backdrop target the <dialog> itself; content is wrapped in a div.
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
      className="m-auto w-[min(calc(100vw-1.5rem),44rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {t("priceHistoryTitle")}
            </h2>
            <p className="truncate text-sm text-[var(--muted)]">{listingTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="shrink-0 rounded-md border border-[var(--border)] px-2.5 py-1 text-sm hover:bg-[var(--background)]"
          >
            {t("priceHistoryClose")}
          </button>
        </div>

        {state.status === "loading" ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]" role="status">
            {t("priceHistoryLoading")}
          </p>
        ) : null}

        {state.status === "error" ? (
          <div className="space-y-2 py-8 text-center" role="alert">
            <p className="text-sm text-red-600 dark:text-red-400">{t("priceHistoryError")}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              {t("priceHistoryRetry")}
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? <PriceHistoryDetails points={state.points} /> : null}
      </div>
    </dialog>
  );
}

function PriceHistoryDetails({ points }: { points: PricePoint[] }) {
  const locale = useLocale();
  const t = useTranslations();
  const summary = summarizePriceSeries(points);

  if (!summary) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">{t("priceHistoryNotEnough")}</p>;
  }

  const changePercent = formatChangePercent(summary.changePercent, locale);
  const stats: Array<{ label: string; point: PricePoint }> = [
    { label: t("priceHistoryLowest"), point: summary.lowest },
    { label: t("priceHistoryHighest"), point: summary.highest },
    { label: t("priceHistoryFirst"), point: summary.first },
    { label: t("priceHistoryCurrent"), point: summary.latest },
  ];

  return (
    <div className="space-y-4">
      <PriceLineChart points={points} label={t("priceHistoryTitle")} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, point }) => (
          <div key={label} className="rounded-md border border-[var(--border)] p-2">
            <dt className="text-xs text-[var(--muted)]">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatPriceCents(point.priceCents, locale)}</dd>
            <dd className="text-xs text-[var(--muted)]">{formatShortDate(point.observedAt, locale)}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm">
        <span className="text-[var(--muted)]">{t("priceHistoryChange")}: </span>
        <span className={`font-semibold tabular-nums ${DIRECTION_CLASS[summary.direction]}`}>
          {summary.direction === "flat"
            ? t("priceHistoryUnchanged")
            : `${formatChangeCents(summary.changeCents, locale)}${changePercent ? ` (${changePercent})` : ""}`}
        </span>
        <span className="text-[var(--muted)]">
          {" · "}
          {t("priceHistoryObservations", { count: summary.count, days: DEAL_QUALITY_HISTORY_DAYS })}
        </span>
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--accent)] hover:underline">
          {t("priceHistoryShowTable")}
        </summary>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("priceHistoryTableCaption")}</caption>
            <thead className="sticky top-0 bg-[var(--card)] text-xs text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {t("priceHistoryTableDate")}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  {t("priceHistoryTablePrice")}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point, index) => (
                <tr key={`${point.observedAt}-${index}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">{formatDateTime(point.observedAt, locale)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatPriceCents(point.priceCents, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
