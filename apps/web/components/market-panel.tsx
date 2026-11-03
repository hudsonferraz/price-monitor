"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { DIRECTION_CLASS, formatChangeCents, formatChangePercent, PriceLineChart } from "@/components/price-line-chart";
import { formatDateTime, formatPriceCents } from "@/lib/i18n";
import type { SearchMarket } from "@price-monitor/shared/market-price";
import { summarizePriceSeries } from "@price-monitor/shared/price-history";

/** Collapsible market summary for one saved search: typical price, range, and its 30-day trend. */
export function MarketPanel({ market }: { market: SearchMarket }) {
  const locale = useLocale();
  const t = useTranslations();
  const { snapshot, trend } = market;
  const trendSummary = summarizePriceSeries(trend);

  return (
    <details className="rounded-md border border-[var(--border)] text-sm">
      <summary className="cursor-pointer px-3 py-2">
        <span className="font-medium">{t("marketTitle")}</span>
        {snapshot ? (
          <span className="text-[var(--muted)]">
            {" · "}
            {t("marketSummaryShort", { price: formatPriceCents(snapshot.marketPriceCents, locale) })}
          </span>
        ) : null}
      </summary>

      <div className="space-y-3 border-t border-[var(--border)] p-3">
        {snapshot ? (
          <>
            <dl className="grid gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--muted)]">{t("marketPrice")}</dt>
                <dd className="font-semibold tabular-nums">{formatPriceCents(snapshot.marketPriceCents, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">{t("marketRange")}</dt>
                <dd className="tabular-nums">
                  {formatPriceCents(snapshot.p25Cents, locale)} – {formatPriceCents(snapshot.p75Cents, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">{t("marketBasedOn")}</dt>
                <dd>
                  {t("marketListingsCount", { count: snapshot.count })}
                  {market.observedAt ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {formatDateTime(market.observedAt, locale)}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-[var(--muted)]">{t("marketExplanation")}</p>
          </>
        ) : (
          <p className="text-[var(--muted)]">{t("marketNotEnough")}</p>
        )}

        {trendSummary ? (
          <div className="space-y-2">
            <p>
              <span className="text-[var(--muted)]">{t("marketTrendChange")}: </span>
              <span className={`font-semibold tabular-nums ${DIRECTION_CLASS[trendSummary.direction]}`}>
                {trendSummary.direction === "flat"
                  ? t("priceHistoryUnchanged")
                  : `${formatChangeCents(trendSummary.changeCents, locale)}${
                      formatChangePercent(trendSummary.changePercent, locale)
                        ? ` (${formatChangePercent(trendSummary.changePercent, locale)})`
                        : ""
                    }`}
              </span>
            </p>
            <PriceLineChart points={trend} label={t("marketTrendLabel")} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
