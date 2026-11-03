import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { getTelegramBotStatus } from "@/lib/telegram";
import { prisma } from "@price-monitor/database";
import { LINK_CODE_TTL_MS } from "@price-monitor/shared/telegram-notifications";
import { NextResponse } from "next/server";

/** Creates a one-time code and the t.me deep link that carries it to the bot. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const bot = await getTelegramBotStatus();
  if (!bot.running || !bot.username) {
    return apiErrorResponse("TELEGRAM_NOT_CONFIGURED", 503);
  }

  const userId = session.user.id;
  const now = new Date();
  // 24 random bytes -> 48 hex chars (Telegram allows up to 64). Letters and digits only: a trailing
  // "_" or "-" is dropped when a link is auto-linked in chat apps or Markdown, which broke the code.
  const code = randomBytes(24).toString("hex");
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);

  await prisma.$transaction([
    // Only the newest link works.
    prisma.telegramLinkCode.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    prisma.telegramLinkCode.create({ data: { code, userId, expiresAt } }),
    prisma.telegramConnection.upsert({ where: { userId }, create: { userId }, update: {} }),
  ]);

  return NextResponse.json({
    deepLink: `https://t.me/${bot.username}?start=${code}`,
    expiresAt: expiresAt.toISOString(),
  });
}
