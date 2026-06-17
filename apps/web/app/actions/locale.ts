"use server";

import { auth } from "@/auth";
import { isAppLocale, LOCALE_COOKIE_NAME, type AppLocale } from "@/lib/i18n/locales";
import { prisma } from "@price-monitor/database";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLocaleAction(formData: FormData): Promise<void> {
  const localeValue = formData.get("locale");
  if (typeof localeValue !== "string" || !isAppLocale(localeValue)) {
    return;
  }

  const locale = localeValue as AppLocale;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLocale: locale },
    });
  }

  revalidatePath("/", "layout");
}
