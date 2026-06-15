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

interface AlertsFeedProps {
  alerts: AlertRecord[];
}

export function AlertsFeed({ alerts }: AlertsFeedProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshAlerts() {
    setIsRefreshing(true);
    router.refresh();
    setIsRefreshing(false);
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        No alerts yet. Click &quot;Poll now&quot; on a saved search to check Facebook Marketplace.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{alerts.length} alert(s)</p>
        <button
          type="button"
          onClick={refreshAlerts}
          disabled={isRefreshing}
          className="text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <ul className="space-y-3">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
          >
            {alert.listing.imageUrl ? (
              <img
                src={alert.listing.imageUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-[var(--background)] text-xs text-[var(--muted)]">
                No image
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Facebook
                </span>
                <span className="text-xs text-[var(--muted)]">{alert.savedSearch.name}</span>
              </div>
              <h3 className="font-medium leading-snug">{alert.listing.title}</h3>
              <p className="text-sm font-semibold">{formatPrice(alert.listing.priceCents)}</p>
              {alert.listing.location ? (
                <p className="text-xs text-[var(--muted)]">{alert.listing.location}</p>
              ) : null}
              <p className="text-xs text-[var(--muted)]">
                {new Date(alert.createdAt).toLocaleString("pt-BR")}
              </p>
              <a
                href={alert.listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-[var(--accent)] hover:underline"
              >
                View listing
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
