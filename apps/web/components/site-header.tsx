import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { auth } from "@/auth";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";
import { isDemoMode } from "@/lib/demo-mode";

export async function SiteHeader() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslator(locale);

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight">
            {t("appName")}
          </Link>
          {isDemoMode() ? (
            <span
              className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
              title={t("demoBadgeHint")}
            >
              {t("demoBadge")}
            </span>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <LanguageSwitch />
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                {t("navDashboard")}
              </Link>
              <span className="hidden text-[var(--muted)] sm:inline">{session.user.email}</span>
              <Link
                href="/api/auth/signout"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--background)]"
              >
                {t("navSignOut")}
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-white hover:bg-[var(--accent-hover)]"
            >
              {t("navSignIn")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
