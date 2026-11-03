import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { getTelegramBotStatus, serializeTelegramConnection } from "@/lib/telegram";
import { prisma } from "@price-monitor/database";
import { telegramSettingsSchema } from "@price-monitor/shared/schemas";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const [bot, connection] = await Promise.all([
    getTelegramBotStatus(),
    prisma.telegramConnection.findUnique({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ bot, connection: serializeTelegramConnection(connection) });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const parsed = telegramSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiErrorResponse("VALIDATION_FAILED", 400, { details: parsed.error.flatten() });
  }

  const existing = await prisma.telegramConnection.findUnique({ where: { userId: session.user.id } });
  if (!existing) {
    return apiErrorResponse("TELEGRAM_NOT_CONNECTED", 404);
  }

  const updated = await prisma.telegramConnection.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  return NextResponse.json({ connection: serializeTelegramConnection(updated) });
}

/** Unlinks the chat; settings are kept for a later reconnect. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  await prisma.telegramConnection.updateMany({
    where: { userId: session.user.id },
    data: { chatId: null, testRequestedAt: null },
  });
  return new NextResponse(null, { status: 204 });
}
