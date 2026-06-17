"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AlertRecord {
  id: string;
  createdAt: string;
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
  };
}

function formatPrice(cents: number | null): string {
  if (cents == null) {
    return "Price unavailable";
  }
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

const DEFAULT_VISIBLE_COUNT = 5;

function splitAlertsByPoll(
  alerts: AlertRecord[],
  latestPollStartedAt: string | null,
  isFirstPollResults: boolean,
): { newAlerts: AlertRecord[]; previousAlerts: AlertRecord[] } {
  if (isFirstPollResults || !latestPollStartedAt) {
    return { newAlerts: alerts, previousAlerts: [] };
  }

  const cutoff = new Date(latestPollStartedAt).getTime();
  const newAlerts: AlertRecord[] = [];
  const previousAlerts: AlertRecord[] = [];

  for (const alert of alerts) {
    if (new Date(alert.createdAt).getTime() >= cutoff) {
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
  return (
    <li className="flex gap-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
      {alert.listing.imageUrl ? (
        <img
          src={alert.listing.imageUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[var(--card)] text-xs text-[var(--muted)]">
          No image
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="text-sm font-medium leading-snug">{alert.listing.title}</h4>
        <p className="text-sm font-semibold">{formatPrice(alert.listing.priceCents)}</p>
        {alert.listing.location ? (
          <p className="text-xs text-[var(--muted)]">{alert.listing.location}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          Found {new Date(alert.createdAt).toLocaleString("pt-BR")}
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
  alerts: AlertRecord[];
  isFirstPollResults?: boolean;
  latestPollStartedAt?: string | null;
}

export function SearchAlertsSection({
  savedSearchId,
  alerts,
  isFirstPollResults = false,
  latestPollStartedAt = null,
}: SearchAlertsSectionProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(alerts.length > 0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const { newAlerts, previousAlerts } = splitAlertsByPoll(
    alerts,
    latestPollStartedAt,
    isFirstPollResults,
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
        <button
          type="button"
          onClick={clearAllAlerts}
          disabled={isClearing}
          className="text-xs text-[var(--muted)] hover:text-red-600 hover:underline disabled:opacity-50"
        >
          {isClearing ? "Clearing..." : "Clear all"}
        </button>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          {isFirstPollResults ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              First poll — showing all matches from the latest scan (up to 24 per poll).
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
              title={`All matches (${alerts.length})`}
              alerts={alerts}
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
    <SearchAlertsSection
      savedSearchId=""
      alerts={alerts}
      isFirstPollResults
    />
  );
}
