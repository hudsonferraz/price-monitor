import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { getTelegramBotStatus } from "@/lib/telegram";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

/** Asks the worker (which holds the bot token) to send a test message on its next loop. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const bot = await getTelegramBotStatus();
  if (!bot.running) {
    return apiErrorResponse("TELEGRAM_NOT_CONFIGURED", 503);
  }

  const { count } = await prisma.telegramConnection.updateMany({
    where: { userId: session.user.id, chatId: { not: null } },
    data: { testRequestedAt: new Date() },
  });
  if (count === 0) {
    return apiErrorResponse("TELEGRAM_NOT_CONNECTED", 404);
  }

  return NextResponse.json({ requested: true }, { status: 202 });
}
