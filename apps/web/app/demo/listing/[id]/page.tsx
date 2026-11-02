import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";

interface DemoListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function DemoListingPage({ params }: DemoListingPageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslator(locale);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-md px-4 py-16">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
          {t("demoBadge")}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{t("demoListingTitle")}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t("demoListingBody")}</p>
        <p className="mt-3 break-all font-mono text-xs text-[var(--muted)]">
          {t("demoListingId", { id: decodeURIComponent(id) })}
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          {t("demoListingBack")}
        </Link>
      </main>
    </div>
  );
}
