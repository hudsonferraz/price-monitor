import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getTranslator(locale);

  const features = [
    {
      title: t("homeFeatureSaveTitle"),
      description: t("homeFeatureSaveDescription"),
    },
    {
      title: t("homeFeaturePollingTitle"),
      description: t("homeFeaturePollingDescription"),
    },
    {
      title: t("homeFeatureAlertsTitle"),
      description: t("homeFeatureAlertsDescription"),
    },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">
            {t("homeEyebrow")}
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{t("homeTitle")}</h1>
          <p className="max-w-xl text-lg text-[var(--muted)]">{t("homeDescription")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/sign-in"
              className="rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              {t("homeGetStarted")}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--card)]"
            >
              {t("homeGoToDashboard")}
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
