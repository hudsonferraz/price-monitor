"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

function formatPrice(cents: number | null): string {
  if (cents == null) {
    return "Price unavailable";
  }
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

const DEFAULT_VISIBLE_COUNT = 5;

const sortLabels: Record<AlertSortOption, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

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
  onDismiss?: (alertId: string) => void;
  isDismissing?: boolean;
}

function AlertCard({ alert, onDismiss, isDismissing = false }: AlertCardProps) {
  const hasPriceDrop = alert.priceDroppedAt != null && alert.previousPriceCents != null;

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
          No image
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {hasPriceDrop ? (
          <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-900/40 dark:text-orange-200">
            Price drop · was {formatPrice(alert.previousPriceCents)}
          </span>
        ) : null}
        <h4 className="text-sm font-medium leading-snug">{alert.listing.title}</h4>
        <p className="text-sm font-semibold">{formatPrice(alert.listing.priceCents)}</p>
        {alert.listing.location ? (
          <p className="text-xs text-[var(--muted)]">{alert.listing.location}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          First seen {formatDateTime(alert.listing.firstSeenAt)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Last seen {formatDateTime(alert.listing.lastSeenAt)}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <a
            href={alert.listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View on Facebook
          </a>
          {onDismiss ? (
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              disabled={isDismissing}
              className="text-sm text-[var(--muted)] hover:text-red-600 hover:underline disabled:opacity-50"
            >
              {isDismissing ? "Removing..." : "Dismiss"}
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
  onDismiss?: (alertId: string) => void;
  dismissingId: string | null;
  defaultExpanded?: boolean;
}

function AlertListGroup({
  title,
  alerts,
  onDismiss,
  dismissingId,
  defaultExpanded = true,
}: AlertListGroupProps) {
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
        <span className="text-xs text-[var(--accent)]">{isExpanded ? "Hide" : "Show"}</span>
      </button>

      {isExpanded ? (
        <div className="space-y-2">
          <ul className="space-y-2">
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
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
              Show all {alerts.length}
            </button>
          ) : null}

          {showAll && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-sm text-[var(--muted)] hover:underline"
            >
              Show less
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
  isFirstPollResults?: boolean;
  latestPollStartedAt?: string | null;
}

export function SearchAlertsSection({
  savedSearchId,
  listingLimit,
  alerts,
  isFirstPollResults = false,
  latestPollStartedAt = null,
}: SearchAlertsSectionProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(alerts.length > 0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [sortBy, setSortBy] = useState<AlertSortOption>("date-desc");

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
    if (!window.confirm("Remove all listings for this search from your dashboard?")) {
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
        No listings yet. Click <strong>Poll now</strong> to search Facebook Marketplace.
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
            Listings ({alerts.length})
          </span>
          <span className="ml-2 text-xs text-[var(--accent)]">{isExpanded ? "Hide" : "Show"}</span>
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Sort
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
            {isClearing ? "Clearing..." : "Clear all"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          {isFirstPollResults ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              First poll — showing all matches from the latest scan (up to {listingLimit} per poll).
            </p>
          ) : null}

          {!isFirstPollResults && newAlerts.length > 0 ? (
            <AlertListGroup
              title={`New since last poll (${newAlerts.length})`}
              alerts={newAlerts}
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded
            />
          ) : null}

          {!isFirstPollResults && previousAlerts.length > 0 ? (
            <AlertListGroup
              title={`Previous listings (${previousAlerts.length})`}
              alerts={previousAlerts}
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded={newAlerts.length === 0}
            />
          ) : null}

          {isFirstPollResults ? (
            <AlertListGroup
              title={`All matches (${sortedAlerts.length})`}
              alerts={sortedAlerts}
              onDismiss={dismissAlert}
              dismissingId={dismissingId}
              defaultExpanded
            />
          ) : null}

          {!isFirstPollResults && newAlerts.length === 0 && previousAlerts.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              No new listings since the last poll. Showing previous matches below.
            </p>
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
    <SearchAlertsSection savedSearchId="" listingLimit={24} alerts={alerts} isFirstPollResults />
  );
}
