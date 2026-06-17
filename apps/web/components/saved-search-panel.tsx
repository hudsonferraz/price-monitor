"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchAlertsSection, type AlertRecord } from "@/components/alerts-feed";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { PollStatusBanner, type SearchPollState } from "@/components/poll-status-banner";
import { PollRunHistory, type PollRunRecord } from "@/components/poll-run-history";
import { formatAnyPrice, formatDateTime, formatPriceCents } from "@/lib/i18n";
import { LISTING_LIMIT_OPTIONS } from "@price-monitor/shared/queue";

export interface SavedSearchRecord {
  id: string;
  name: string;
  keywords: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  pollIntervalMin: number;
  listingLimit: number;
  isEnabled: boolean;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
  recentPollRuns: PollRunRecord[];
  alerts: AlertRecord[];
  isFirstPollResults: boolean;
  latestPollStartedAt: string | null;
}

function centsToReaisInput(cents: number | null): string {
  if (cents == null) {
    return "";
  }
  return String(cents / 100);
}

function formatPriceRange(cents: number | null, locale: ReturnType<typeof useLocale>): string {
  if (cents == null) {
    return formatAnyPrice(locale);
  }

  return formatPriceCents(cents, locale);
}

interface SavedSearchFormProps {
  initialSearch?: SavedSearchRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SavedSearchForm({ initialSearch, onSuccess, onCancel }: SavedSearchFormProps) {
  const router = useRouter();
  const t = useTranslations();
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
  const [listingLimit, setListingLimit] = useState(String(initialSearch?.listingLimit ?? 24));
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
      listingLimit: Number(listingLimit),
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
        setError(data?.error ?? t("searchFormSaveFailed"));
        return;
      }

      onSuccess?.();
      router.refresh();
    } catch {
      setError(t("searchFormSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          {t("searchFormName")}
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder={t("searchFormNamePlaceholder")}
        />
      </div>

      <div>
        <label htmlFor="keywords" className="mb-1 block text-sm font-medium">
          {t("searchFormKeywords")}
        </label>
        <input
          id="keywords"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          required
          maxLength={200}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder={t("searchFormKeywordsPlaceholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="minPriceReais" className="mb-1 block text-sm font-medium">
            {t("searchFormMinPrice")}
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
            {t("searchFormMaxPrice")}
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
          {t("searchFormPollInterval")}
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

      <div>
        <label htmlFor="listingLimit" className="mb-1 block text-sm font-medium">
          {t("searchFormListingLimit")}
        </label>
        <select
          id="listingLimit"
          value={listingLimit}
          onChange={(event) => setListingLimit(event.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          {LISTING_LIMIT_OPTIONS.map((limit) => (
            <option key={limit} value={limit}>
              {t("searchListingsPerPoll", { count: limit })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">{t("searchFormListingLimitHint")}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
          className="rounded border-[var(--border)]"
        />
        {t("searchFormEnabled")}
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isSubmitting
            ? t("searchFormSaving")
            : isEditing
              ? t("searchFormUpdate")
              : t("searchFormCreate")}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--background)]"
          >
            {t("searchFormCancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

interface SavedSearchListProps {
  searches: SavedSearchRecord[];
  emptyMessage: string;
}

export function SavedSearchList({ searches, emptyMessage }: SavedSearchListProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [watchingPollSearchId, setWatchingPollSearchId] = useState<string | null>(null);
  const [searchPollStates, setSearchPollStates] = useState<Record<string, SearchPollState>>({});

  function updateSearchPollState(searchId: string, state: SearchPollState | null) {
    setSearchPollStates((current) => {
      if (!state) {
        const { [searchId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [searchId]: state };
    });
  }

  useEffect(() => {
    if (!watchingPollSearchId) {
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();
    const maxWaitMs = 3 * 60 * 1000;
    const searchId = watchingPollSearchId;

    async function checkPollStatus(): Promise<boolean> {
      const [runsResponse, statusResponse] = await Promise.all([
        fetch(`/api/searches/${searchId}/poll-runs?limit=1`).catch(() => null),
        fetch(`/api/searches/${searchId}/poll-status`).catch(() => null),
      ]);

      if (statusResponse?.ok) {
        const status = (await statusResponse.json()) as {
          jobState?: string;
          message?: string;
        };

        if (status.jobState === "waiting" || status.jobState === "delayed") {
          updateSearchPollState(searchId, {
            phase: "queued",
            message: status.message ?? t("pollStatusQueuedAuto"),
          });
        }

        if (status.jobState === "active") {
          updateSearchPollState(searchId, {
            phase: "running",
            message: t("pollCheckingMarketplace"),
          });
        }
      }

      if (!runsResponse?.ok) {
        return false;
      }

      const runs = (await runsResponse.json()) as PollRunRecord[];
      const latestRun = runs[0];
      router.refresh();

      if (latestRun?.status === "RUNNING") {
        updateSearchPollState(searchId, {
          phase: "running",
          message: t("pollCheckingMarketplace"),
        });
        return false;
      }

      if (latestRun?.status === "SUCCESS") {
        updateSearchPollState(searchId, {
          phase: "success",
          message: t("pollStatusSuccessSummary", {
            listings: latestRun.listingsFound,
            alerts: latestRun.newAlerts,
          }),
        });
        window.setTimeout(() => updateSearchPollState(searchId, null), 8_000);
        return true;
      }

      if (latestRun?.status === "FAILED") {
        updateSearchPollState(searchId, {
          phase: "failed",
          message: latestRun.errorMessage ?? t("pollStatusFailedGeneric"),
        });
        return true;
      }

      if (Date.now() - startedAt > maxWaitMs) {
        updateSearchPollState(searchId, {
          phase: "failed",
          message: t("pollStatusTimeout"),
        });
        return true;
      }

      return false;
    }

    const intervalId = window.setInterval(async () => {
      if (cancelled) {
        return;
      }

      const isFinished = await checkPollStatus();
      if (isFinished) {
        setWatchingPollSearchId(null);
      }
    }, 10_000);

    void checkPollStatus();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [watchingPollSearchId, router, t]);

  async function pollNow(searchId: string) {
    setPollingId(searchId);
    setWatchingPollSearchId(null);
    updateSearchPollState(searchId, {
      phase: "queuing",
      message: t("pollStatusSending"),
    });

    try {
      const response = await fetch(`/api/searches/${searchId}/poll`, { method: "POST" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        updateSearchPollState(searchId, {
          phase: "failed",
          message: data?.error ?? t("pollStatusFailedQueue"),
        });
        return;
      }

      updateSearchPollState(searchId, {
        phase: "queued",
        message: data?.message ?? t("pollStatusQueuedAuto"),
      });
      setWatchingPollSearchId(searchId);
      router.refresh();
    } catch {
      updateSearchPollState(searchId, {
        phase: "failed",
        message: t("pollStatusFailedQueue"),
      });
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
    if (!window.confirm(t("searchDeleteConfirm"))) {
      return;
    }

    await fetch(`/api/searches/${searchId}`, { method: "DELETE" });
    setEditingId(null);
    router.refresh();
  }

  if (searches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {searches.map((search) => {
          const isEditing = editingId === search.id;
          const latestRun = search.recentPollRuns[0];
          const livePollState =
            searchPollStates[search.id] ??
            (latestRun?.status === "RUNNING"
              ? {
                  phase: "running" as const,
                  message: t("pollCheckingMarketplace"),
                }
              : null);

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
                      <p className="text-sm text-[var(--muted)]">
                        {t("searchKeywords")}: {search.keywords}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {search.alerts.length > 0 ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          {t("searchListingsCount", { count: search.alerts.length })}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          search.isEnabled
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}
                      >
                        {search.isEnabled ? t("searchEnabled") : t("searchDisabled")}
                      </span>
                    </div>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--muted)]">{t("searchPriceRange")}</dt>
                      <dd>
                        {formatPriceRange(search.minPriceCents, locale)} –{" "}
                        {formatPriceRange(search.maxPriceCents, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">{t("searchPollEvery")}</dt>
                      <dd>{t("searchMinutes", { count: search.pollIntervalMin })}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">{t("searchMaxPerPoll")}</dt>
                      <dd>{t("searchListingsPerPoll", { count: search.listingLimit })}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">{t("searchLastPolled")}</dt>
                      <dd>
                        {search.lastPolledAt
                          ? formatDateTime(search.lastPolledAt, locale)
                          : t("searchNever")}
                      </dd>
                    </div>
                  </dl>

                  {livePollState ? <PollStatusBanner pollState={livePollState} /> : null}

                  <PollRunHistory pollRuns={search.recentPollRuns} />

                  <SearchAlertsSection
                    savedSearchId={search.id}
                    listingLimit={search.listingLimit}
                    alerts={search.alerts}
                    isFirstPollResults={search.isFirstPollResults}
                    latestPollStartedAt={search.latestPollStartedAt}
                  />

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => pollNow(search.id)}
                      disabled={
                        !search.isEnabled ||
                        pollingId === search.id ||
                        latestRun?.status === "RUNNING"
                      }
                      className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      {pollingId === search.id
                        ? t("searchQueuing")
                        : latestRun?.status === "RUNNING"
                          ? t("searchPolling")
                          : t("searchPollNow")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(search.id)}
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)]"
                    >
                      {t("searchEdit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEnabled(search)}
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)]"
                    >
                      {search.isEnabled ? t("searchDisable") : t("searchEnable")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSearch(search.id)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      {t("searchDelete")}
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
