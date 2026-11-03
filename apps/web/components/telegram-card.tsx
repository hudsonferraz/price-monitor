"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { translateApiError } from "@/lib/api-error-i18n";
import { formatDateTime } from "@/lib/i18n";

interface TelegramConnectionState {
  connected: boolean;
  paused: boolean;
  mode: "NEW_AND_DROPS" | "DROPS_ONLY";
  minDropPercent: number;
  quietStartMinute: number | null;
  quietEndMinute: number | null;
  timeZone: string;
  linkedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  testPending: boolean;
}

interface TelegramStatus {
  bot: { running: boolean; username: string | null };
  connection: TelegramConnectionState | null;
}

const BRAZIL_TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Cuiaba",
  "America/Fortaleza",
  "America/Recife",
  "America/Belem",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
];

const LINK_WAIT_POLL_MS = 3_000;

function minuteToTime(minute: number | null, fallback: string): string {
  if (minute == null) return fallback;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function timeToMinute(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

const buttonClass =
  "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--background)] disabled:opacity-50";
const primaryButtonClass =
  "rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50";

export function TelegramCard() {
  const locale = useLocale();
  const t = useTranslations();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/telegram", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const next = (await response.json()) as TelegramStatus;
      setStatus(next);
      setLoadFailed(false);
      return next;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While a link is open, poll until the bot confirms it (or the code expires).
  useEffect(() => {
    if (!deepLink) return;
    const interval = window.setInterval(async () => {
      const next = await load();
      if (next?.connection?.connected || (linkExpiresAt != null && Date.now() > linkExpiresAt)) {
        setDeepLink(null);
        setLinkExpiresAt(null);
        if (next?.connection?.connected) setMessage({ tone: "ok", text: t("telegramConnectedNow") });
      }
    }, LINK_WAIT_POLL_MS);
    return () => window.clearInterval(interval);
  }, [deepLink, linkExpiresAt, load, t]);

  // A pending test message clears once the worker sends it.
  useEffect(() => {
    if (!status?.connection?.testPending) return;
    const timeout = window.setTimeout(() => void load(), LINK_WAIT_POLL_MS);
    return () => window.clearTimeout(timeout);
  }, [status, load]);

  async function request(path: string, init: RequestInit, onOk?: (body: unknown) => void) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
      });
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({ tone: "error", text: translateApiError((body as { errorCode?: string } | null)?.errorCode, t) });
        return false;
      }
      onOk?.(body);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    await request("/api/telegram/link", { method: "POST" }, (body) => {
      const { deepLink: link, expiresAt } = body as { deepLink: string; expiresAt: string };
      setDeepLink(link);
      setLinkExpiresAt(new Date(expiresAt).getTime());
      window.open(link, "_blank", "noopener,noreferrer");
    });
  }

  const connection = status?.connection ?? null;
  const isConnected = Boolean(connection?.connected);
  const botRunning = Boolean(status?.bot.running);

  let pill: { label: string; className: string };
  if (!botRunning) {
    pill = { label: t("telegramStatusOff"), className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" };
  } else if (isConnected && connection?.paused) {
    pill = { label: t("telegramStatusPaused"), className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" };
  } else if (isConnected) {
    pill = { label: t("telegramStatusConnected"), className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  } else {
    pill = { label: t("telegramStatusNotConnected"), className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" };
  }

  return (
    <section className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("telegramTitle")}</h2>
        {status ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}>{pill.label}</span>
        ) : null}
      </div>

      {loadFailed && !status ? <p className="text-sm text-red-600 dark:text-red-400">{t("telegramLoadError")}</p> : null}
      {!status && !loadFailed ? <p className="text-sm text-[var(--muted)]">{t("telegramLoading")}</p> : null}

      {status && !botRunning ? (
        <div className="space-y-1 text-sm text-[var(--muted)]">
          <p>{t("telegramNotConfigured")}</p>
          <p>{t("telegramNotConfiguredHint")}</p>
        </div>
      ) : null}

      {status && botRunning && !isConnected ? (
        <div className="space-y-3 text-sm">
          <p className="text-[var(--muted)]">{t("telegramConnectDescription")}</p>
          {deepLink ? (
            <div className="space-y-1 rounded-md border border-[var(--border)] bg-[var(--background)] p-3" role="status">
              <p className="font-medium">{t("telegramWaiting")}</p>
              <p className="text-[var(--muted)]">
                {t("telegramWaitingHint")}{" "}
                <a href={deepLink} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                  {t("telegramOpenBot", { bot: `@${status.bot.username}` })}
                </a>
              </p>
            </div>
          ) : (
            <button type="button" onClick={connect} disabled={busy} className={primaryButtonClass}>
              {t("telegramConnect")}
            </button>
          )}
        </div>
      ) : null}

      {status && botRunning && connection && isConnected ? (
        <ConnectedPanel
          connection={connection}
          botUsername={status.bot.username}
          busy={busy}
          onRequest={request}
        />
      ) : null}

      {connection?.lastErrorMessage && connection.lastErrorAt ? (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
          {t("telegramLastError", {
            date: formatDateTime(connection.lastErrorAt, locale),
            error: connection.lastErrorMessage,
          })}
        </p>
      ) : null}

      {message ? (
        <p
          className={`mt-3 text-sm ${message.tone === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

interface ConnectedPanelProps {
  connection: TelegramConnectionState;
  botUsername: string | null;
  busy: boolean;
  onRequest: (path: string, init: RequestInit, onOk?: (body: unknown) => void) => Promise<boolean>;
}

function ConnectedPanel({ connection, botUsername, busy, onRequest }: ConnectedPanelProps) {
  const t = useTranslations();
  const [mode, setMode] = useState(connection.mode);
  const [minDropPercent, setMinDropPercent] = useState(String(connection.minDropPercent));
  const [quietEnabled, setQuietEnabled] = useState(connection.quietStartMinute != null);
  const [quietStart, setQuietStart] = useState(minuteToTime(connection.quietStartMinute, "23:00"));
  const [quietEnd, setQuietEnd] = useState(minuteToTime(connection.quietEndMinute, "07:00"));
  const [timeZone, setTimeZone] = useState(connection.timeZone);
  const [saved, setSaved] = useState(false);

  const timeZones = BRAZIL_TIME_ZONES.includes(connection.timeZone)
    ? BRAZIL_TIME_ZONES
    : [connection.timeZone, ...BRAZIL_TIME_ZONES];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const ok = await onRequest("/api/telegram", {
      method: "PATCH",
      body: JSON.stringify({
        mode,
        minDropPercent: Math.min(90, Math.max(0, Math.round(Number(minDropPercent) || 0))),
        quietStartMinute: quietEnabled ? timeToMinute(quietStart) : null,
        quietEndMinute: quietEnabled ? timeToMinute(quietEnd) : null,
        timeZone,
      }),
    });
    setSaved(ok);
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-[var(--muted)]">
        {connection.paused ? t("telegramPausedDescription") : t("telegramConnectedDescription", { bot: `@${botUsername ?? ""}` })}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || connection.testPending}
          onClick={() => onRequest("/api/telegram/test", { method: "POST" })}
          className={buttonClass}
        >
          {connection.testPending ? t("telegramTestPending") : t("telegramSendTest")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onRequest("/api/telegram", { method: "PATCH", body: JSON.stringify({ paused: !connection.paused }) })
          }
          className={buttonClass}
        >
          {connection.paused ? t("telegramResume") : t("telegramPause")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRequest("/api/telegram", { method: "DELETE" })}
          className={`${buttonClass} text-red-600 dark:text-red-400`}
        >
          {t("telegramDisconnect")}
        </button>
      </div>

      <details className="rounded-md border border-[var(--border)]">
        <summary className="cursor-pointer px-3 py-2 font-medium">{t("telegramSettingsTitle")}</summary>
        <form onSubmit={save} className="grid gap-3 border-t border-[var(--border)] p-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-medium">{t("telegramModeLabel")}</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as TelegramConnectionState["mode"])}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          >
            <option value="NEW_AND_DROPS">{t("telegramModeNewAndDrops")}</option>
            <option value="DROPS_ONLY">{t("telegramModeDropsOnly")}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-medium">{t("telegramMinDropLabel")}</span>
          <input
            type="number"
            min={0}
            max={90}
            step={1}
            value={minDropPercent}
            onChange={(event) => setMinDropPercent(event.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">{t("telegramMinDropHint")}</span>
        </label>

        <label className="block">
          <span className="mb-1 block font-medium">{t("telegramTimeZoneLabel")}</span>
          <select
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
          >
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace("America/", "").replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quietEnabled}
              onChange={(event) => setQuietEnabled(event.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <span className="font-medium">{t("telegramQuietHoursLabel")}</span>
          </label>
          {quietEnabled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="time"
                aria-label={t("telegramQuietFrom")}
                value={quietStart}
                onChange={(event) => setQuietStart(event.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
              />
              <span className="text-[var(--muted)]">{t("telegramQuietTo")}</span>
              <input
                type="time"
                aria-label={t("telegramQuietUntil")}
                value={quietEnd}
                onChange={(event) => setQuietEnd(event.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
              />
            </div>
          ) : null}
          <p className="mt-1 text-xs text-[var(--muted)]">{t("telegramQuietHoursHint")}</p>
        </fieldset>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {t("telegramSaveSettings")}
          </button>
          {saved ? <span className="text-green-700 dark:text-green-400">{t("telegramSettingsSaved")}</span> : null}
        </div>
      </form>
      </details>
    </div>
  );
}
