"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { formatDateTime, formatPriceCents } from "@/lib/i18n";
import type { AlertSortOption } from "@price-monitor/shared/sort-alerts";
import { sortAlerts } from "@price-monitor/shared/sort-alerts";

export interface AlertRecord {
  id: string;
  createdAt: string;
  previousPriceCents: number | null;
  priceDroppedAt: string | null;
  savedSearch: { id: string; name: string };
  listing: {
    id: string;
    source: string;
    title: string;
    priceCents: number | null;
    currency: string;
    url: string;
    imageUrl: string | null;
    location: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
  };
}

const DEFAULT_VISIBLE_COUNT = 5;

function isAlertNewSincePoll(
  alert: AlertRecord,
  latestPollStartedAt: string | null,
  isFirstPollResults: boolean,
): boolean {
  if (isFirstPollResults || !latestPollStartedAt) {
    return true;
  }

  const cutoff = new Date(latestPollStartedAt).getTime();
  if (alert.priceDroppedAt && new Date(alert.priceDroppedAt).getTime() >= cutoff) {
    return true;
  }

  return new Date(alert.createdAt).getTime() >= cutoff;
}

function splitAlertsByPoll(
  alerts: AlertRecord[],
  latestPollStartedAt: string | null,
  isFirstPollResults: boolean,
): { newAlerts: AlertRecord[]; previousAlerts: AlertRecord[] } {
  if (isFirstPollResults || !latestPollStartedAt) {
    return { newAlerts: alerts, previousAlerts: [] };
  }

  const newAlerts: AlertRecord[] = [];
  const previousAlerts: AlertRecord[] = [];

  for (const alert of alerts) {
    if (isAlertNewSincePoll(alert, latestPollStartedAt, isFirstPollResults)) {
      newAlerts.push(alert);
    } else {
      previousAlerts.push(alert);
    }
  }

  return { newAlerts, previousAlerts };
}

interface AlertCardProps {
  alert: AlertRecord;
  searchKeywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  isBaselineResults: boolean;
  isNewMatch: boolean;
  onDismiss?: (alertId: string) => void;
  isDismissing?: boolean;
}

function AlertCard({
  alert,
  searchKeywords,
  minPriceCents,
  maxPriceCents,
  isBaselineResults,
  isNewMatch,
  onDismiss,
  isDismissing = false,
}: AlertCardProps) {
  const locale = useLocale();
  const t = useTranslations();
  const hasPriceDrop = alert.priceDroppedAt != null && alert.previousPriceCents != null;
  const matchedKeyword = getMatchedKeyword(alert.listing.title, searchKeywords);
  const isWithinPriceRange = isListingWithinPriceRange(
    alert.listing.priceCents,
    minPriceCents,
    maxPriceCents,
  );

  return (
    <li className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3 sm:flex-row">
      {alert.listing.imageUrl ? (
        <img
          src={alert.listing.imageUrl}
          alt=""
          className="h-40 w-full rounded-md object-cover sm:h-16 sm:w-16 sm:shrink-0"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-md bg-[var(--card)] text-xs text-[var(--muted)] sm:h-16 sm:w-16 sm:shrink-0">
          {t("alertsNoImage")}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap gap-1.5">
          {hasPriceDrop ? (
            <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-900/40 dark:text-orange-200">
              {t("alertsPriceDrop", {
                price: formatPriceCents(alert.previousPriceCents, locale),
              })}
            </span>
          ) : null}
          {matchedKeyword ? (
            <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-200">
              {t("alertsWhyKeyword", { keyword: matchedKeyword })}
            </span>
          ) : null}
          {isWithinPriceRange ? (
            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
              {t("alertsWhyPriceRange")}
            </span>
          ) : null}
          {isBaselineResults ? (
            <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
              {t("alertsWhyBaseline")}
            </span>
          ) : null}
          {!isBaselineResults && isNewMatch ? (
            <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
              {t("alertsWhyNew")}
            </span>
          ) : null}
        </div>
        <h4 className="text-sm font-medium leading-snug">{alert.listing.title}</h4>
        <p className="text-sm font-semibold">{formatPriceCents(alert.listing.priceCents, locale)}</p>
        {alert.listing.location ? (
          <p className="text-xs text-[var(--muted)]">{alert.listing.location}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          {t("alertsFirstSeen", {
            date: formatDateTime(alert.listing.firstSeenAt, locale),
          })}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {t("alertsLastSeen", {
            date: formatDateTime(alert.listing.lastSeenAt, locale),
          })}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <a
            href={alert.listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            {t("alertsViewFacebook")}
          </a>
          {onDismiss ? (
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              disabled={isDismissing}
              className="text-sm text-[var(--muted)] hover:text-red-600 hover:underline disabled:opacity-50"
            >
              {isDismissing ? t("alertsDismissing") : t("alertsDismiss")}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

interface AlertListGroupProps {
  title: string;
  alerts: AlertRecord[];
  searchKeywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  isBaselineResults: boolean;
  isNewMatch: boolean;
  onDismiss?: (alertId: string) => void;
  dismissingId: string | null;
  defaultExpanded?: boolean;
}

function AlertListGroup({
  title,
  alerts,
  searchKeywords,
  minPriceCents,
  maxPriceCents,
  isBaselineResults,
  isNewMatch,
  onDismiss,
  dismissingId,
  defaultExpanded = true,
}: AlertListGroupProps) {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  if (alerts.length === 0) {
    return null;
  }

  const visibleAlerts = showAll ? alerts : alerts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = alerts.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-medium text-[var(--muted)]">{title}</span>
        <span className="text-xs text-[var(--accent)]">
          {isExpanded ? t("alertsHide") : t("alertsShow")}
        </span>
      </button>

      {isExpanded ? (
        <div className="space-y-2">
          <ul className="space-y-2">
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                searchKeywords={searchKeywords}
                minPriceCents={minPriceCents}
                maxPriceCents={maxPriceCents}
                isBaselineResults={isBaselineResults}
                isNewMatch={isNewMatch}
                onDismiss={onDismiss}
                isDismissing={dismissingId === alert.id}
              />
            ))}
          </ul>

          {hiddenCount > 0 && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              {t("alertsShowAll", { count: alerts.length })}
            </button>
          ) : null}

          {showAll && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-sm text-[var(--muted)] hover:underline"
            >
              {t("alertsShowLess")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SearchAlertsSectionProps {
  savedSearchId: string;
  listingLimit: number;
  alerts: AlertRecord[];
  searchKeywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  isFirstPollResults?: boolean;
  latestPollStartedAt?: string | null;
}

export function SearchAlertsSection({
  savedSearchId,
  listingLimit,
  alerts,
  searchKeywords,
  minPriceCents,
  maxPriceCents,
  isFirstPollResults = false,
  latestPollStartedAt = null,
}: SearchAlertsSectionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(alerts.length > 0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [sortBy, setSortBy] = useState<AlertSortOption>("date-desc");

  const sortLabels: Record<AlertSortOption, string> = {
    "date-desc": t("alertsSortNewest"),
    "date-asc": t("alertsSortOldest"),
    "price-asc": t("alertsSortPriceAsc"),
    "price-desc": t("alertsSortPriceDesc"),
  };

  const sortedAlerts = useMemo(() => sortAlerts(alerts, sortBy), [alerts, sortBy]);

  const { newAlerts, previousAlerts } = useMemo(
    () => splitAlertsByPoll(sortedAlerts, latestPollStartedAt, isFirstPollResults),
    [sortedAlerts, latestPollStartedAt, isFirstPollResults],
  );

  async function dismissAlert(alertId: string) {
    setDismissingId(alertId);
    try {
      const response = await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setDismissingId(null);
    }
  }

  async function clearAllAlerts() {
    if (!window.confirm(t("alertsClearConfirm"))) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch(`/api/searches/${savedSearchId}/alerts`, { method: "DELETE" });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setIsClearing(false);
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
        {t("alertsNoListings")}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="text-left"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {t("alertsListingsTitle", { count: alerts.length })}
          </span>
          <span className="ml-2 text-xs text-[var(--accent)]">
            {isExpanded ? t("alertsHide") : t("alertsShow")}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            {t("alertsSort")}
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as AlertSortOption)}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)]"
            >
              {(Object.keys(sortLabels) as AlertSortOption[]).map((option) => (
                <option key={option} value={option}>
                  {sortLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearAllAlerts}
            disabled={isClearing}
            className="text-xs text-[var(--muted)] hover:text-red-600 hover:underline disabled:opacity-50"
          >
            {isClearing ? t("alertsClearing") : t("alertsClearAll")}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          {isFirstPollResults ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              {t("alertsBaselineBanner", { limit: listingLimit })}
            </p>
          ) : null}

          {!isFirstPollResults && newAlerts.length > 0 ? (
            <AlertListGroup
              title={t("alertsNewSincePoll", { count: newAlerts.length })}
              alerts={newAlerts}
              searchKeywords={searchKeywords}
              minPriceCents={minPriceCents}
              maxPriceCents={maxPriceCents}
              isBaselineResults={false}
              isNewMatch
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded
            />
          ) : null}

          {!isFirstPollResults && previousAlerts.length > 0 ? (
            <AlertListGroup
              title={t("alertsPreviousListings", { count: previousAlerts.length })}
              alerts={previousAlerts}
              searchKeywords={searchKeywords}
              minPriceCents={minPriceCents}
              maxPriceCents={maxPriceCents}
              isBaselineResults={false}
              isNewMatch={false}
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded={newAlerts.length === 0}
            />
          ) : null}

          {isFirstPollResults ? (
            <AlertListGroup
              title={t("alertsBaselineResults", { count: sortedAlerts.length })}
              alerts={sortedAlerts}
              searchKeywords={searchKeywords}
              minPriceCents={minPriceCents}
              maxPriceCents={maxPriceCents}
              isBaselineResults
              isNewMatch={false}
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded
            />
          ) : null}

          {!isFirstPollResults && newAlerts.length === 0 && previousAlerts.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">{t("alertsNoNewSincePoll")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface AlertsFeedProps {
  alerts: AlertRecord[];
}

/** @deprecated Use SearchAlertsSection inside each saved search card. */
export function AlertsFeed({ alerts }: AlertsFeedProps) {
  return (
    <SearchAlertsSection
      savedSearchId=""
      listingLimit={24}
      alerts={alerts}
      searchKeywords=""
      minPriceCents={null}
      maxPriceCents={null}
      isFirstPollResults
    />
  );
}

function getMatchedKeyword(title: string, searchKeywords: string): string | null {
  const normalizedTitle = title.toLowerCase();
  const terms = searchKeywords
    .split(/[\s,]+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3);

  return terms.find((term) => normalizedTitle.includes(term)) ?? null;
}

function isListingWithinPriceRange(
  priceCents: number | null,
  minPriceCents: number | null,
  maxPriceCents: number | null,
): boolean {
  if (priceCents == null) {
    return false;
  }

  if (minPriceCents != null && priceCents < minPriceCents) {
    return false;
  }

  if (maxPriceCents != null && priceCents > maxPriceCents) {
    return false;
  }

  return minPriceCents != null || maxPriceCents != null;
}
