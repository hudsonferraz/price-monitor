import { normalizeAppLocale, type AppLocale } from "./locales";

/**
 * Pure rules for Telegram deal notifications: which poll events to send, quiet hours, and message
 * text. The worker does the I/O; everything decidable without I/O lives here so it is unit-tested.
 */

export const NOTIFICATIONS_PER_POLL = 5;
export const LINK_CODE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_NOTIFICATION_TIME_ZONE = "America/Sao_Paulo";
export const MAX_MIN_DROP_PERCENT = 90;
/** The web app treats the bot as running if the worker refreshed its state this recently. */
export const TELEGRAM_BOT_STALE_MS = 2 * 60 * 1000;

export type NotificationKind = "new" | "drop";
export type NotificationModeValue = "NEW_AND_DROPS" | "DROPS_ONLY";

export interface NotificationEvent {
  alertId: string;
  kind: NotificationKind;
  /** "new" or "drop:<ISO>", unique per alert event. */
  eventKey: string;
  title: string;
  priceCents: number | null;
  previousPriceCents?: number | null;
  location?: string | null;
  url: string;
  imageUrl?: string | null;
  searchName: string;
  occurredAt: Date;
  /** Whole percent below the search's market price for this poll, when at least 10%. */
  belowMarketPercent?: number | null;
  marketPriceCents?: number | null;
}

export interface NotificationSettings {
  connected: boolean;
  paused: boolean;
  searchEnabled: boolean;
  mode: NotificationModeValue;
  minDropPercent: number;
  quietStartMinute: number | null;
  quietEndMinute: number | null;
  timeZone: string;
}

export type SkipReason =
  | "not_connected"
  | "paused"
  | "search_disabled"
  | "quiet_hours"
  | "mode_drops_only"
  | "below_min_drop";

export interface NotificationSelection {
  send: NotificationEvent[];
  summarized: NotificationEvent[];
  skipped: Array<{ event: NotificationEvent; reason: SkipReason }>;
}

export function getNewMatchEventKey(): string {
  return "new";
}

export function getDropEventKey(priceDroppedAt: Date): string {
  return `drop:${priceDroppedAt.toISOString()}`;
}

/** Percentage the price fell (positive number), or null when it is not a drop. */
export function getDropPercent(previousPriceCents: number | null | undefined, priceCents: number | null): number | null {
  if (previousPriceCents == null || priceCents == null || previousPriceCents <= 0) return null;
  if (priceCents >= previousPriceCents) return null;
  return ((previousPriceCents - priceCents) / previousPriceCents) * 100;
}

function getMinuteOfDay(now: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return getMinuteOfDay(now, DEFAULT_NOTIFICATION_TIME_ZONE);
  }
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return (hour % 24) * 60 + minute;
}

/** Quiet window [start, end) in minutes since local midnight; may wrap past midnight. */
export function isWithinQuietHours(
  now: Date,
  startMinute: number | null,
  endMinute: number | null,
  timeZone: string,
): boolean {
  if (startMinute == null || endMinute == null || startMinute === endMinute) return false;
  const minute = getMinuteOfDay(now, timeZone);
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function getSkipReason(event: NotificationEvent, settings: NotificationSettings, now: Date): SkipReason | null {
  if (!settings.connected) return "not_connected";
  if (settings.paused) return "paused";
  if (!settings.searchEnabled) return "search_disabled";
  if (isWithinQuietHours(now, settings.quietStartMinute, settings.quietEndMinute, settings.timeZone)) {
    return "quiet_hours";
  }
  if (event.kind === "new" && settings.mode === "DROPS_ONLY") return "mode_drops_only";
  if (event.kind === "drop" && settings.minDropPercent > 0) {
    const percent = getDropPercent(event.previousPriceCents, event.priceCents) ?? 0;
    if (percent < settings.minDropPercent) return "below_min_drop";
  }
  return null;
}

/** Biggest drops first, then new matches, newest first. */
function compareEvents(a: NotificationEvent, b: NotificationEvent): number {
  if (a.kind !== b.kind) return a.kind === "drop" ? -1 : 1;
  if (a.kind === "drop") {
    const difference =
      (getDropPercent(b.previousPriceCents, b.priceCents) ?? 0) -
      (getDropPercent(a.previousPriceCents, a.priceCents) ?? 0);
    if (difference !== 0) return difference;
  }
  return b.occurredAt.getTime() - a.occurredAt.getTime() || a.alertId.localeCompare(b.alertId);
}

export function selectNotifications(
  events: NotificationEvent[],
  settings: NotificationSettings,
  now: Date,
  limit = NOTIFICATIONS_PER_POLL,
): NotificationSelection {
  const skipped: NotificationSelection["skipped"] = [];
  const eligible: NotificationEvent[] = [];
  for (const event of events) {
    const reason = getSkipReason(event, settings, now);
    if (reason) skipped.push({ event, reason });
    else eligible.push(event);
  }
  eligible.sort(compareEvents);
  return { send: eligible.slice(0, limit), summarized: eligible.slice(limit), skipped };
}

const MESSAGES = {
  "pt-BR": {
    newMatch: "Nova oferta",
    priceDrop: "Preço caiu",
    was: "era",
    search: "Busca",
    belowMarket: (percent: number, market: string) => `📊 ${percent}% abaixo do mercado (${market})`,
    open: "Abrir anúncio",
    summary: (count: number, search: string) =>
      `E mais ${count} ${count === 1 ? "oferta" : "ofertas"} em "${search}". Veja no painel:`,
    connected: "✅ Telegram conectado ao price-monitor. Você vai receber novas ofertas e quedas de preço aqui.",
    expired: "Este link expirou ou já foi usado. Gere um novo no painel do price-monitor.",
    disconnected: "Notificações desativadas. Para reconectar, use o botão “Conectar Telegram” no painel.",
    help: "Para receber alertas, abra o painel do price-monitor e clique em “Conectar Telegram”. Envie /stop para desconectar.",
    test: "🔔 Mensagem de teste do price-monitor. Está tudo certo!",
    dashboard: "Abrir painel",
  },
  "en-US": {
    newMatch: "New deal",
    priceDrop: "Price drop",
    was: "was",
    search: "Search",
    belowMarket: (percent: number, market: string) => `📊 ${percent}% below market (${market})`,
    open: "Open listing",
    summary: (count: number, search: string) =>
      `And ${count} more ${count === 1 ? "deal" : "deals"} in "${search}". See the dashboard:`,
    connected: "✅ Telegram connected to price-monitor. New deals and price drops will arrive here.",
    expired: "This link expired or was already used. Create a new one from the price-monitor dashboard.",
    disconnected: "Notifications turned off. To reconnect, use “Connect Telegram” on the dashboard.",
    help: "To get alerts, open the price-monitor dashboard and click “Connect Telegram”. Send /stop to disconnect.",
    test: "🔔 Test message from price-monitor. Everything works!",
    dashboard: "Open dashboard",
  },
} as const;

export type BotMessageKey = "connected" | "expired" | "disconnected" | "help" | "test";

export function getBotMessage(key: BotMessageKey, locale: string | null | undefined): string {
  return MESSAGES[normalizeAppLocale(locale)][key];
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatBrl(cents: number | null | undefined, locale: AppLocale): string {
  if (cents == null) return locale === "pt-BR" ? "Preço indisponível" : "Price unavailable";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function resolveAppUrl(url: string, appBaseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${appBaseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?$)/i;

/** Telegram fetches photos itself, so only absolute URLs on public hosts can be sent as photos. */
export function isPublicImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && !PRIVATE_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export interface FormattedNotification {
  /** HTML (parse_mode "HTML"). */
  text: string;
  /** Same content without markup, used if Telegram rejects the HTML or link. */
  plainText: string;
  photoUrl: string | null;
}

export function formatNotification(
  event: NotificationEvent,
  localeInput: string | null | undefined,
  appBaseUrl: string,
): FormattedNotification {
  const locale = normalizeAppLocale(localeInput);
  const m = MESSAGES[locale];
  const link = resolveAppUrl(event.url, appBaseUrl);
  const price = formatBrl(event.priceCents, locale);
  const dropPercent = event.kind === "drop" ? getDropPercent(event.previousPriceCents, event.priceCents) : null;
  const priceLine =
    event.kind === "drop" && event.previousPriceCents != null
      ? `${price} (${m.was} ${formatBrl(event.previousPriceCents, locale)}${
          dropPercent != null ? `, −${Math.round(dropPercent)}%` : ""
        })`
      : price;
  const heading = event.kind === "drop" ? `📉 ${m.priceDrop}` : `🆕 ${m.newMatch}`;
  const marketLine =
    event.belowMarketPercent && event.marketPriceCents
      ? m.belowMarket(event.belowMarketPercent, formatBrl(event.marketPriceCents, locale))
      : null;

  const plainLines = [
    heading,
    event.title,
    priceLine,
    ...(marketLine ? [marketLine] : []),
    ...(event.location ? [`📍 ${event.location}`] : []),
    `${m.search}: ${event.searchName}`,
    link,
  ];
  const htmlLines = [
    `<b>${escapeHtml(heading)}</b>`,
    escapeHtml(event.title),
    `<b>${escapeHtml(priceLine)}</b>`,
    ...(marketLine ? [escapeHtml(marketLine)] : []),
    ...(event.location ? [`📍 ${escapeHtml(event.location)}`] : []),
    `${escapeHtml(m.search)}: ${escapeHtml(event.searchName)}`,
    `<a href="${escapeHtml(link)}">${escapeHtml(m.open)}</a>`,
  ];

  return {
    text: htmlLines.join("\n"),
    plainText: plainLines.join("\n"),
    photoUrl: isPublicImageUrl(event.imageUrl) ? event.imageUrl : null,
  };
}

export function formatSummary(
  count: number,
  searchName: string,
  localeInput: string | null | undefined,
  appBaseUrl: string,
): { text: string; plainText: string } {
  const m = MESSAGES[normalizeAppLocale(localeInput)];
  const dashboard = resolveAppUrl("/dashboard", appBaseUrl);
  return {
    text: `${escapeHtml(m.summary(count, searchName))} <a href="${escapeHtml(dashboard)}">${escapeHtml(m.dashboard)}</a>`,
    plainText: `${m.summary(count, searchName)} ${dashboard}`,
  };
}

/** Parses "/start <code>", "/stop", "/help" (also "/start@BotName <code>"). */
export function parseBotCommand(
  text: string | null | undefined,
): { command: "start"; code: string | null } | { command: "stop" | "help" | "unknown" } {
  const match = /^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/.exec((text ?? "").trim());
  if (!match) return { command: "unknown" };
  const name = match[1].toLowerCase();
  if (name === "start") return { command: "start", code: match[2] ?? null };
  if (name === "stop") return { command: "stop" };
  if (name === "help") return { command: "help" };
  return { command: "unknown" };
}

export function isLinkCodeUsable(code: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean {
  return code.usedAt == null && code.expiresAt.getTime() > now.getTime();
}
