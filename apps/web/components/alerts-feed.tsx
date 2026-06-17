"use client";

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

interface AlertCardProps {
  alert: AlertRecord;
  compact?: boolean;
}

function AlertCard({ alert, compact = false }: AlertCardProps) {
  return (
    <li
      className={`flex gap-3 rounded-md border border-[var(--border)] bg-[var(--background)] ${
        compact ? "p-3" : "gap-4 p-4"
      }`}
    >
      {alert.listing.imageUrl ? (
        <img
          src={alert.listing.imageUrl}
          alt=""
          className={`shrink-0 rounded-md object-cover ${compact ? "h-16 w-16" : "h-20 w-20"}`}
        />
      ) : (
        <div
          className={`flex shrink-0 items-center justify-center rounded-md bg-[var(--card)] text-xs text-[var(--muted)] ${
            compact ? "h-16 w-16" : "h-20 w-20"
          }`}
        >
          No image
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {!compact ? (
          <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            Facebook
          </span>
        ) : null}
        <h4 className={`font-medium leading-snug ${compact ? "text-sm" : ""}`}>{alert.listing.title}</h4>
        <p className={`font-semibold ${compact ? "text-sm" : "text-sm"}`}>
          {formatPrice(alert.listing.priceCents)}
        </p>
        {alert.listing.location ? (
          <p className="text-xs text-[var(--muted)]">{alert.listing.location}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          Found {new Date(alert.createdAt).toLocaleString("pt-BR")}
        </p>
        <a
          href={alert.listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-[var(--accent)] hover:underline"
        >
          View on Facebook
        </a>
      </div>
    </li>
  );
}

interface SearchAlertsSectionProps {
  alerts: AlertRecord[];
  isFirstPollResults?: boolean;
}

export function SearchAlertsSection({ alerts, isFirstPollResults = false }: SearchAlertsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(alerts.length > 0);
  const [showAll, setShowAll] = useState(false);

  if (alerts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
        No listings yet. Click <strong>Poll now</strong> to search Facebook Marketplace.
      </div>
    );
  }

  const visibleAlerts = showAll ? alerts : alerts.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = alerts.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Listings ({alerts.length})
        </span>
        <span className="text-xs text-[var(--accent)]">{isExpanded ? "Hide" : "Show"}</span>
      </button>

      {isExpanded ? (
        <div className="space-y-2">
          {isFirstPollResults ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              First poll — showing all matches from the latest scan (up to 24 per poll).
            </p>
          ) : null}

          <ul className="space-y-2">
            {visibleAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} compact />
            ))}
          </ul>

          {hiddenCount > 0 && !showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Show all {alerts.length} listings
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

interface AlertsFeedProps {
  alerts: AlertRecord[];
}

/** @deprecated Use SearchAlertsSection inside each saved search card. */
export function AlertsFeed({ alerts }: AlertsFeedProps) {
  return <SearchAlertsSection alerts={alerts} />;
}
