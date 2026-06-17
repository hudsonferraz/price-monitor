import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE_NAME,
  type AppLocale,
} from "./locales";

export async function getLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isAppLocale(cookieLocale)) {
    return cookieLocale;
  }

  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLocale: true },
    });

    if (isAppLocale(user?.preferredLocale)) {
      return user.preferredLocale;
    }
  }

  return DEFAULT_LOCALE;
}
