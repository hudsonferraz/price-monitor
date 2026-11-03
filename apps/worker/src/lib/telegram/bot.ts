import { prisma } from "@price-monitor/database";
import {
  getBotMessage,
  isLinkCodeUsable,
  parseBotCommand,
} from "@price-monitor/shared/telegram-notifications";
import { type TelegramClient, type TelegramMessage, TelegramApiError } from "./client";
import { createConfiguredTelegramClient, deliverTelegramMessage } from "./notify";

export const BOT_STATE_ID = "default";

export interface TelegramBotOptions {
  client?: TelegramClient;
  /** Long-poll timeout for getUpdates. Short in tests. */
  pollTimeoutSeconds?: number;
  /** Pause after a failed getUpdates before retrying. */
  errorBackoffMs?: number;
  now?: () => Date;
}

export interface TelegramBotHandle {
  username: string;
  stop(): Promise<void>;
}

function guessLocale(message: TelegramMessage): string {
  return (message.from as { language_code?: string } | undefined)?.language_code?.toLowerCase().startsWith("pt")
    ? "pt-BR"
    : "en-US";
}

async function reply(client: TelegramClient, chatId: string, text: string): Promise<void> {
  try {
    await client.sendMessage(chatId, text);
  } catch (error) {
    console.warn(`[telegram] could not reply in chat: ${error instanceof Error ? error.message : error}`);
  }
}

export async function handleTelegramMessage(
  client: TelegramClient,
  message: TelegramMessage,
  now: Date = new Date(),
): Promise<void> {
  const chatId = String(message.chat.id);
  if (message.chat.type !== "private") return; // Group chats are out of scope.

  const linked = await prisma.telegramConnection.findUnique({
    where: { chatId },
    include: { user: { select: { preferredLocale: true } } },
  });
  const locale = linked?.user.preferredLocale ?? guessLocale(message);
  const command = parseBotCommand(message.text);

  if (command.command === "start" && command.code) {
    const linkCode = await prisma.telegramLinkCode.findUnique({
      where: { code: command.code },
      include: { user: { select: { preferredLocale: true } } },
    });
    if (!linkCode || !isLinkCodeUsable(linkCode, now)) {
      await reply(client, chatId, getBotMessage("expired", locale));
      return;
    }

    await prisma.$transaction([
      prisma.telegramLinkCode.update({ where: { code: linkCode.code }, data: { usedAt: now } }),
      // One chat belongs to at most one user: the newest link wins.
      prisma.telegramConnection.updateMany({
        where: { chatId, NOT: { userId: linkCode.userId } },
        data: { chatId: null },
      }),
      prisma.telegramConnection.upsert({
        where: { userId: linkCode.userId },
        create: { userId: linkCode.userId, chatId, linkedAt: now },
        update: { chatId, linkedAt: now, paused: false, lastErrorAt: null, lastErrorMessage: null },
      }),
    ]);
    await reply(client, chatId, getBotMessage("connected", linkCode.user.preferredLocale));
    return;
  }

  if (command.command === "stop") {
    await prisma.telegramConnection.updateMany({ where: { chatId }, data: { chatId: null } });
    await reply(client, chatId, getBotMessage("disconnected", locale));
    return;
  }

  await reply(client, chatId, getBotMessage("help", locale));
}

/** Sends test messages requested from the dashboard (the web app has no bot token). */
export async function sendPendingTestMessages(client: TelegramClient, now: Date = new Date()): Promise<number> {
  const pending = await prisma.telegramConnection.findMany({
    where: { testRequestedAt: { not: null }, chatId: { not: null } },
    include: { user: { select: { preferredLocale: true } } },
  });

  for (const connection of pending) {
    const text = getBotMessage("test", connection.user.preferredLocale);
    try {
      await deliverTelegramMessage(client, connection.chatId as string, { text, plainText: text });
      await prisma.telegramConnection.update({
        where: { id: connection.id },
        data: { testRequestedAt: null, lastErrorAt: null, lastErrorMessage: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Telegram error";
      await prisma.telegramConnection.update({
        where: { id: connection.id },
        data: {
          testRequestedAt: null,
          lastErrorAt: now,
          lastErrorMessage: message.slice(0, 500),
          ...(error instanceof TelegramApiError && error.isChatUnavailable ? { chatId: null } : {}),
        },
      });
    }
  }
  return pending.length;
}

async function touchBotState(username: string, now: Date, lastError: string | null): Promise<void> {
  await prisma.telegramBotState.upsert({
    where: { id: BOT_STATE_ID },
    create: { id: BOT_STATE_ID, botUsername: username, lastSeenAt: now, lastError },
    update: { botUsername: username, lastSeenAt: now, lastError },
  });
}

/**
 * Starts the bot when TELEGRAM_BOT_TOKEN is set: validates the token, then long-polls Telegram for
 * messages (no webhook, so it works without a public URL). Returns null when not configured.
 */
export async function startTelegramBot(options: TelegramBotOptions = {}): Promise<TelegramBotHandle | null> {
  const client = options.client ?? createConfiguredTelegramClient();
  if (!client) return null;

  const now = options.now ?? (() => new Date());
  const pollTimeoutSeconds = options.pollTimeoutSeconds ?? 10;
  const errorBackoffMs = options.errorBackoffMs ?? 5_000;

  const me = await client.getMe();
  const username = me.username ?? "unknown_bot";
  await touchBotState(username, now(), null);

  let running = true;
  let offset: number | undefined;
  const abort = new AbortController();

  const loop = (async () => {
    while (running) {
      try {
        const updates = await client.getUpdates(offset, pollTimeoutSeconds, abort.signal);
        for (const update of updates) {
          offset = update.update_id + 1;
          if (update.message) {
            await handleTelegramMessage(client, update.message, now()).catch((error) =>
              console.error(`[telegram] failed to handle a message: ${error instanceof Error ? error.message : error}`),
            );
          }
        }
        await sendPendingTestMessages(client, now());
        await touchBotState(username, now(), null);
      } catch (error) {
        if (!running) break;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[telegram] update loop error: ${message}`);
        await touchBotState(username, now(), message.slice(0, 500)).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, errorBackoffMs));
      }
    }
  })();

  return {
    username,
    async stop() {
      running = false;
      abort.abort();
      await loop.catch(() => {});
    },
  };
}
