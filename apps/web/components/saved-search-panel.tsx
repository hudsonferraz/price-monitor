"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PollRunHistory, type PollRunRecord } from "@/components/poll-run-history";

export interface SavedSearchRecord {
  id: string;
  name: string;
  keywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  pollIntervalMin: number;
  isEnabled: boolean;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
  recentPollRuns: PollRunRecord[];
}

function centsToReaisInput(cents: number | null): string {
  if (cents == null) {
    return "";
  }
  return String(cents / 100);
}

function formatPrice(cents: number | null): string {
  if (cents == null) {
    return "Any";
  }
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

interface SavedSearchFormProps {
  initialSearch?: SavedSearchRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SavedSearchForm({ initialSearch, onSuccess, onCancel }: SavedSearchFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialSearch?.name ?? "");
  const [keywords, setKeywords] = useState(initialSearch?.keywords ?? "");
  const [minPriceReais, setMinPriceReais] = useState(
    centsToReaisInput(initialSearch?.minPriceCents ?? null),
  );
  const [maxPriceReais, setMaxPriceReais] = useState(
    centsToReaisInput(initialSearch?.maxPriceCents ?? null),
  );
  const [pollIntervalMin, setPollIntervalMin] = useState(
    String(initialSearch?.pollIntervalMin ?? 30),
  );
  const [isEnabled, setIsEnabled] = useState(initialSearch?.isEnabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(initialSearch);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      ...(isEditing ? { id: initialSearch!.id } : {}),
      name,
      keywords,
      minPriceReais: minPriceReais ? Number(minPriceReais) : null,
      maxPriceReais: maxPriceReais ? Number(maxPriceReais) : null,
      pollIntervalMin: Number(pollIntervalMin),
      isEnabled,
    };

    try {
      const response = await fetch("/api/searches", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Failed to save search");
        return;
      }

      onSuccess?.();
      router.refresh();
    } catch {
      setError("Failed to save search");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder="iPhone 13 deals"
        />
      </div>

      <div>
        <label htmlFor="keywords" className="mb-1 block text-sm font-medium">
          Keywords
        </label>
        <input
          id="keywords"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          required
          maxLength={200}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder="iphone 13"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="minPriceReais" className="mb-1 block text-sm font-medium">
            Min price (R$)
          </label>
          <input
            id="minPriceReais"
            type="number"
            min="0"
            step="0.01"
            value={minPriceReais}
            onChange={(event) => setMinPriceReais(event.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="800"
          />
        </div>
        <div>
          <label htmlFor="maxPriceReais" className="mb-1 block text-sm font-medium">
            Max price (R$)
          </label>
          <input
            id="maxPriceReais"
            type="number"
            min="0"
            step="0.01"
            value={maxPriceReais}
            onChange={(event) => setMaxPriceReais(event.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="2500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pollIntervalMin" className="mb-1 block text-sm font-medium">
          Poll interval (minutes)
        </label>
        <input
          id="pollIntervalMin"
          type="number"
          min="5"
          max="1440"
          value={pollIntervalMin}
          onChange={(event) => setPollIntervalMin(event.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
          className="rounded border-[var(--border)]"
        />
        Enabled
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : isEditing ? "Update search" : "Create search"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--background)]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

interface SavedSearchListProps {
  searches: SavedSearchRecord[];
}

export function SavedSearchList({ searches }: SavedSearchListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [pollMessage, setPollMessage] = useState<string | null>(null);

  async function pollNow(searchId: string) {
    setPollingId(searchId);
    setPollMessage(null);

    try {
      const response = await fetch(`/api/searches/${searchId}/poll`, { method: "POST" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setPollMessage(data?.error ?? "Failed to queue poll");
        return;
      }

      setPollMessage(data?.message ?? "Poll queued.");
      router.refresh();
    } catch {
      setPollMessage("Failed to queue poll");
    } finally {
      setPollingId(null);
    }
  }

  async function toggleEnabled(search: SavedSearchRecord) {
    await fetch("/api/searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: search.id, isEnabled: !search.isEnabled }),
    });
    router.refresh();
  }

  async function deleteSearch(searchId: string) {
    if (!window.confirm("Delete this saved search?")) {
      return;
    }

    await fetch(`/api/searches/${searchId}`, { method: "DELETE" });
    setEditingId(null);
    router.refresh();
  }

  if (searches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        No saved searches yet. Create one below to start monitoring Facebook Marketplace.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pollMessage ? (
        <p
          className={`rounded-md border px-4 py-3 text-sm ${
            pollMessage.toLowerCase().includes("wait") ||
            pollMessage.toLowerCase().includes("minute") ||
            pollMessage.toLowerCase().includes("queued")
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
              : "border-[var(--border)] bg-[var(--card)]"
          }`}
        >
          {pollMessage}
        </p>
      ) : null}

      <ul className="space-y-4">
      {searches.map((search) => {
        const isEditing = editingId === search.id;

        return (
          <li
            key={search.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
          >
            {isEditing ? (
              <SavedSearchForm
                initialSearch={search}
                onSuccess={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{search.name}</h3>
                    <p className="text-sm text-[var(--muted)]">Keywords: {search.keywords}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      search.isEnabled
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {search.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--muted)]">Price range</dt>
                    <dd>
                      {formatPrice(search.minPriceCents)} – {formatPrice(search.maxPriceCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Poll every</dt>
                    <dd>{search.pollIntervalMin} min</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Last polled</dt>
                    <dd>
                      {search.lastPolledAt
                        ? new Date(search.lastPolledAt).toLocaleString("pt-BR")
                        : "Never"}
                    </dd>
                  </div>
                </dl>

                <PollRunHistory pollRuns={search.recentPollRuns} />

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => pollNow(search.id)}
                    disabled={!search.isEnabled || pollingId === search.id}
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {pollingId === search.id ? "Queuing..." : "Poll now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(search.id)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEnabled(search)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)]"
                  >
                    {search.isEnabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSearch(search.id)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
      </ul>
    </div>
  );
}

export { formatPrice };
