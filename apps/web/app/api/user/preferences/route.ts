import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailNotificationsEnabled: true, preferredLocale: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    emailNotificationsEnabled: user.emailNotificationsEnabled,
    preferredLocale: user.preferredLocale,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (
    body?.emailNotificationsEnabled == null &&
    body?.preferredLocale == null
  ) {
    return NextResponse.json({ error: "No valid preference fields provided" }, { status: 400 });
  }

  if (
    body?.emailNotificationsEnabled != null &&
    typeof body.emailNotificationsEnabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "emailNotificationsEnabled must be a boolean" },
      { status: 400 },
    );
  }

  const { isAppLocale, LOCALE_COOKIE_NAME } = await import("@/lib/i18n/locales");
  if (body?.preferredLocale != null && !isAppLocale(body.preferredLocale)) {
    return NextResponse.json({ error: "preferredLocale must be en-US or pt-BR" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(body?.emailNotificationsEnabled != null
        ? { emailNotificationsEnabled: body.emailNotificationsEnabled }
        : {}),
      ...(body?.preferredLocale != null ? { preferredLocale: body.preferredLocale } : {}),
    },
    select: { emailNotificationsEnabled: true, preferredLocale: true },
  });

  const response = NextResponse.json(user);

  if (body?.preferredLocale != null) {
    response.cookies.set(LOCALE_COOKIE_NAME, body.preferredLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
