import { prisma, type TelegramConnection } from "@price-monitor/database";
import { TELEGRAM_BOT_STALE_MS } from "@price-monitor/shared/telegram-notifications";

/** Bot status as recorded by the worker (which holds the token; the web app never does). */
export async function getTelegramBotStatus(now: Date = new Date()): Promise<{
  running: boolean;
  username: string | null;
}> {
  const state = await prisma.telegramBotState.findUnique({ where: { id: "default" } });
  if (!state) return { running: false, username: null };
  return {
    running: now.getTime() - state.lastSeenAt.getTime() < TELEGRAM_BOT_STALE_MS,
    username: state.botUsername,
  };
}

export type TelegramConnectionResponse = ReturnType<typeof serializeTelegramConnection>;

export function serializeTelegramConnection(connection: TelegramConnection | null) {
  if (!connection) return null;
  return {
    connected: connection.chatId != null,
    paused: connection.paused,
    mode: connection.mode,
    minDropPercent: connection.minDropPercent,
    quietStartMinute: connection.quietStartMinute,
    quietEndMinute: connection.quietEndMinute,
    timeZone: connection.timeZone,
    linkedAt: connection.linkedAt?.toISOString() ?? null,
    lastErrorAt: connection.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: connection.lastErrorMessage,
    testPending: connection.testRequestedAt != null,
  };
}
