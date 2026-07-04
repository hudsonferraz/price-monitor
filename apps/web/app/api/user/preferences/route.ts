import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { isAppLocale, LOCALE_COOKIE_NAME } from "@/lib/i18n/locales";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferredLocale: true },
  });

  if (!user) {
    return apiErrorResponse("USER_NOT_FOUND", 404);
  }

  return NextResponse.json({
    preferredLocale: user.preferredLocale,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const body = await request.json().catch(() => null);

  if (body?.preferredLocale == null) {
    return apiErrorResponse("NO_PREFERENCE_FIELDS", 400);
  }


  if (body?.preferredLocale != null && !isAppLocale(body.preferredLocale)) {
    return apiErrorResponse("INVALID_PREFERRED_LOCALE", 400);
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(body?.preferredLocale != null ? { preferredLocale: body.preferredLocale } : {}),
    },
    select: { preferredLocale: true },
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
