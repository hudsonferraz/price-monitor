import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { isAppLocale, LOCALE_COOKIE_NAME } from "@/lib/i18n/locales";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const locale = body?.locale;

  if (!isAppLocale(locale)) {
    return NextResponse.json({ error: "locale must be en-US or pt-BR" }, { status: 400 });
  }

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLocale: locale },
    });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}
