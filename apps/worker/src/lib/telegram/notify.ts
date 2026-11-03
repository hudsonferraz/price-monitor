import { NotificationStatus, prisma } from "@price-monitor/database";
import {
  formatNotification,
  formatSummary,
  getDropEventKey,
  getNewMatchEventKey,
  type NotificationEvent,
  type NotificationSettings,
  selectNotifications,
} from "@price-monitor/shared/telegram-notifications";
import {
  createTelegramClient,
  getAppBaseUrl,
  getTelegramApiBaseUrl,
  getTelegramBotToken,
  getTelegramSendIntervalMs,
  TelegramApiError,
  type TelegramClient,
} from "./client";

export interface NotifyPollEventsInput {
  savedSearchId: string;
  newAlertIds: string[];
  dropAlertIds: string[];
}

export interface NotifyDeps {
  client?: TelegramClient | null;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
  sendIntervalMs?: number;
}

export interface NotifyResult {
  sent: number;
  failed: number;
  summarized: number;
  skipped: number;
}

const EMPTY_RESULT: NotifyResult = { sent: 0, failed: 0, summarized: 0, skipped: 0 };
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createConfiguredTelegramClient(): TelegramClient | null {
  const token = getTelegramBotToken();
  return token ? createTelegramClient({ token, baseUrl: getTelegramApiBaseUrl() }) : null;
}

function describeError(error: unknown): string {
  if (error instanceof TelegramApiError) return error.message;
  return error instanceof Error ? error.message : "Unknown Telegram error";
}

/**
 * Sends one message, falling back to plain text without a photo when Telegram rejects the markup
 * or the photo URL, and honoring a single "retry after" on rate limits.
 */
export async function deliverTelegramMessage(
  client: TelegramClient,
  chatId: string,
  message: { text: string; plainText: string; photoUrl?: string | null },
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<void> {
  const attempt = async (plain: boolean) => {
    if (message.photoUrl && !plain) {
      await client.sendPhoto(chatId, message.photoUrl, message.text, { html: true });
    } else if (plain) {
      await client.sendMessage(chatId, message.plainText);
    } else {
      await client.sendMessage(chatId, message.text, { html: true });
    }
  };

  const withRateLimitRetry = async (plain: boolean) => {
    try {
      await attempt(plain);
    } catch (error) {
      if (error instanceof TelegramApiError && error.isRateLimited) {
        await sleep(Math.min(error.retryAfterSeconds ?? 1, 60) * 1000);
        await attempt(plain);
        return;
      }
      throw error;
    }
  };

  try {
    await withRateLimitRetry(false);
  } catch (error) {
    if (error instanceof TelegramApiError && error.isFormattingProblem) {
      await withRateLimitRetry(true);
      return;
    }
    throw error;
  }
}

/**
 * Notifies the search owner on Telegram about the events of one successful poll.
 * Never throws: failures are recorded on the connection and the alert notification rows.
 */
export async function notifyPollEvents(input: NotifyPollEventsInput, deps: NotifyDeps = {}): Promise<NotifyResult> {
  try {
    return await notifyPollEventsUnsafe(input, deps);
  } catch (error) {
    console.error(`[telegram] notification step failed for search ${input.savedSearchId}: ${describeError(error)}`);
    return EMPTY_RESULT;
  }
}

async function notifyPollEventsUnsafe(input: NotifyPollEventsInput, deps: NotifyDeps): Promise<NotifyResult> {
  const client = deps.client === undefined ? createConfiguredTelegramClient() : deps.client;
  // No bot configured: the feature is inert (nothing recorded, nothing sent).
  if (!client || input.newAlertIds.length + input.dropAlertIds.length === 0) return EMPTY_RESULT;

  const now = deps.now ?? new Date();
  const sleep = deps.sleep ?? defaultSleep;
  const sendIntervalMs = deps.sendIntervalMs ?? getTelegramSendIntervalMs();

  const search = await prisma.savedSearch.findUnique({
    where: { id: input.savedSearchId },
    include: { user: { include: { telegramConnection: true } } },
  });
  if (!search) return EMPTY_RESULT;

  const connection = search.user.telegramConnection;
  const alerts = await prisma.alert.findMany({
    where: { id: { in: [...input.newAlertIds, ...input.dropAlertIds] }, dismissedAt: null },
    include: { listing: true },
  });
  const dropIds = new Set(input.dropAlertIds);

  const events: NotificationEvent[] = alerts.flatMap((alert) => {
    const isDrop = dropIds.has(alert.id);
    if (isDrop && !alert.priceDroppedAt) return [];
    return [
      {
        alertId: alert.id,
        kind: isDrop ? "drop" : "new",
        eventKey: isDrop ? getDropEventKey(alert.priceDroppedAt as Date) : getNewMatchEventKey(),
        title: alert.listing.title,
        priceCents: alert.listing.priceCents,
        previousPriceCents: isDrop ? alert.previousPriceCents : null,
        location: alert.listing.location,
        url: alert.listing.url,
        imageUrl: alert.listing.imageUrl,
        searchName: search.name,
        occurredAt: isDrop ? (alert.priceDroppedAt as Date) : alert.createdAt,
      },
    ];
  });

  // Each event is handled once, ever: drop events already recorded (e.g. a retried job).
  const existing = await prisma.alertNotification.findMany({
    where: { OR: events.map((event) => ({ alertId: event.alertId, eventKey: event.eventKey })) },
    select: { alertId: true, eventKey: true },
  });
  const seen = new Set(existing.map((row) => `${row.alertId}|${row.eventKey}`));
  const freshEvents = events.filter((event) => !seen.has(`${event.alertId}|${event.eventKey}`));
  if (freshEvents.length === 0) return EMPTY_RESULT;

  const settings: NotificationSettings = {
    connected: Boolean(connection?.chatId),
    paused: connection?.paused ?? false,
    searchEnabled: search.notificationsEnabled,
    mode: connection?.mode ?? "NEW_AND_DROPS",
    minDropPercent: connection?.minDropPercent ?? 0,
    quietStartMinute: connection?.quietStartMinute ?? null,
    quietEndMinute: connection?.quietEndMinute ?? null,
    timeZone: connection?.timeZone ?? "America/Sao_Paulo",
  };
  const selection = selectNotifications(freshEvents, settings, now);

  // Recorded before sending (at most once). Sent rows start as SENT and are downgraded on failure.
  await prisma.alertNotification.createMany({
    data: [
      ...selection.skipped.map(({ event, reason }) => ({
        alertId: event.alertId,
        eventKey: event.eventKey,
        status: NotificationStatus.SKIPPED,
        reason,
      })),
      ...selection.summarized.map((event) => ({
        alertId: event.alertId,
        eventKey: event.eventKey,
        status: NotificationStatus.SUMMARIZED,
      })),
      ...selection.send.map((event) => ({
        alertId: event.alertId,
        eventKey: event.eventKey,
        status: NotificationStatus.SENT,
      })),
    ],
    skipDuplicates: true,
  });

  const result: NotifyResult = {
    sent: 0,
    failed: 0,
    summarized: selection.summarized.length,
    skipped: selection.skipped.length,
  };
  if (!connection?.chatId || selection.send.length === 0) return result;

  const chatId = connection.chatId;
  const locale = search.user.preferredLocale;
  const appBaseUrl = getAppBaseUrl();
  let lastError: string | null = null;
  let chatUnavailable = false;

  const markFailed = (events: NotificationEvent[], reason: string) =>
    prisma.alertNotification.updateMany({
      where: { OR: events.map((event) => ({ alertId: event.alertId, eventKey: event.eventKey })) },
      data: { status: NotificationStatus.FAILED, reason: reason.slice(0, 500) },
    });

  const messages = [
    ...selection.send.map((event) => ({ event, message: formatNotification(event, locale, appBaseUrl) })),
    ...(selection.summarized.length > 0
      ? [{ event: null, message: formatSummary(selection.summarized.length, search.name, locale, appBaseUrl) }]
      : []),
  ];

  for (const [index, { event, message }] of messages.entries()) {
    if (index > 0 && sendIntervalMs > 0) await sleep(sendIntervalMs);
    try {
      await deliverTelegramMessage(client, chatId, message, sleep);
      if (event) result.sent += 1;
    } catch (error) {
      lastError = describeError(error);
      if (event) {
        result.failed += 1;
        await markFailed([event], lastError);
      }
      if (error instanceof TelegramApiError && error.isChatUnavailable) {
        chatUnavailable = true;
        const remaining = messages.slice(index + 1).flatMap((entry) => (entry.event ? [entry.event] : []));
        if (remaining.length > 0) {
          result.failed += remaining.length;
          await markFailed(remaining, lastError);
        }
        break;
      }
    }
  }

  await prisma.telegramConnection.update({
    where: { id: connection.id },
    data: lastError
      ? {
          lastErrorAt: now,
          lastErrorMessage: lastError.slice(0, 500),
          ...(chatUnavailable ? { chatId: null } : {}),
        }
      : { lastErrorAt: null, lastErrorMessage: null },
  });

  if (lastError) {
    console.warn(`[telegram] search ${search.id}: ${result.failed} message(s) failed: ${lastError}`);
  }
  return result;
}
