import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { auth } from "@/auth";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";

export async function SiteHeader() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslator(locale);

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {t("appName")}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
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
