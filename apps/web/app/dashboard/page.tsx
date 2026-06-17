import { type AlertRecord } from "@/components/alerts-feed";
import { FacebookSessionWarning } from "@/components/facebook-session-warning";
import { MarketplaceLocationHint } from "@/components/marketplace-location-hint";
import { NotificationSettings } from "@/components/notification-settings";
import type { PollRunRecord } from "@/components/poll-run-history";
import { SavedSearchForm, SavedSearchList, type SavedSearchRecord } from "@/components/saved-search-panel";
import { auth } from "@/auth";
import { formatSearchSummary, getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";
import { summarizeRecentPollHealth } from "@/lib/system-health";
import { isFacebookSessionError } from "@price-monitor/shared/poll-errors";
import { prisma } from "@price-monitor/database";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const locale = await getLocale();
  const t = await getTranslator(locale);

  const [searches, pollRuns, user] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        alerts: {
          where: { dismissedAt: null },
          include: { listing: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    }),
    prisma.pollRun.findMany({
      where: { savedSearch: { userId: session.user.id } },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailNotificationsEnabled: true },
    }),
  ]);

  const pollHealth = summarizeRecentPollHealth(pollRuns);

  const pollRunsBySearchId = new Map<string, PollRunRecord[]>();
  const allPollRunsBySearchId = new Map<string, PollRunRecord[]>();
  const successPollCountBySearchId = new Map<string, number>();

  for (const run of pollRuns) {
    if (run.status === "SUCCESS") {
      successPollCountBySearchId.set(
        run.savedSearchId,
        (successPollCountBySearchId.get(run.savedSearchId) ?? 0) + 1,
      );
    }

    const serializedRun = {
      id: run.id,
      status: run.status,
      listingsFound: run.listingsFound,
      newAlerts: run.newAlerts,
      errorMessage: run.errorMessage,
      durationMs: run.durationMs,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };

    const allRuns = allPollRunsBySearchId.get(run.savedSearchId) ?? [];
    allRuns.push(serializedRun);
    allPollRunsBySearchId.set(run.savedSearchId, allRuns);

    const existing = pollRunsBySearchId.get(run.savedSearchId) ?? [];
    if (existing.length < 3) {
      existing.push(serializedRun);
      pollRunsBySearchId.set(run.savedSearchId, existing);
    }
  }

  const serializedSearches: SavedSearchRecord[] = searches.map((search) => {
    const recentPollRuns = pollRunsBySearchId.get(search.id) ?? [];
    const allPollRuns = allPollRunsBySearchId.get(search.id) ?? [];
    const latestSuccess = recentPollRuns.find((run) => run.status === "SUCCESS");
    const successPollCount = successPollCountBySearchId.get(search.id) ?? 0;
    const alerts: AlertRecord[] = search.alerts.map((alert) => ({
      id: alert.id,
      createdAt: alert.createdAt.toISOString(),
      previousPriceCents: alert.previousPriceCents,
      priceDroppedAt: alert.priceDroppedAt?.toISOString() ?? null,
      savedSearch: { id: search.id, name: search.name },
      listing: {
        id: alert.listing.id,
        source: alert.listing.source,
        title: alert.listing.title,
        priceCents: alert.listing.priceCents,
        currency: alert.listing.currency,
        url: alert.listing.url,
        imageUrl: alert.listing.imageUrl,
        location: alert.listing.location,
        firstSeenAt: alert.listing.createdAt.toISOString(),
        lastSeenAt: alert.listing.updatedAt.toISOString(),
      },
    }));

    return {
      id: search.id,
      name: search.name,
      keywords: search.keywords,
      minPriceCents: search.minPriceCents,
      maxPriceCents: search.maxPriceCents,
      pollIntervalMin: search.pollIntervalMin,
      listingLimit: search.listingLimit,
      isEnabled: search.isEnabled,
      lastAttemptedAt: search.lastAttemptedAt?.toISOString() ?? null,
      lastSuccessfulPollAt: search.lastSuccessfulPollAt?.toISOString() ?? null,
      createdAt: search.createdAt.toISOString(),
      updatedAt: search.updatedAt.toISOString(),
      recentPollRuns,
      alerts,
      latestPollStartedAt: latestSuccess?.startedAt ?? null,
      isFirstPollResults: successPollCount === 1 && latestSuccess != null && alerts.length > 0,
      reliability: {
        consecutiveFailures: countConsecutiveFailures(allPollRuns),
        lastFailureMessage: allPollRuns.find((run) => run.status === "FAILED")?.errorMessage ?? null,
        hasFacebookSessionFailure: allPollRuns.some(
          (run) => run.status === "FAILED" && isFacebookSessionError(run.errorMessage),
        ),
      },
    };
  });

  const totalListings = serializedSearches.reduce((sum, search) => sum + search.alerts.length, 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t("dashboardTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("dashboardDescription")}</p>
        </div>

        <section className="mb-10">
          <NotificationSettings
            emailNotificationsEnabled={user?.emailNotificationsEnabled ?? true}
          />
        </section>

        <FacebookSessionWarning show={pollHealth.hasFacebookSessionIssue} />

        <section className="mb-10">
          <MarketplaceLocationHint />
        </section>

        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{t("dashboardYourSearches")}</h2>
              {serializedSearches.length > 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatSearchSummary(locale, serializedSearches.length, totalListings)}
                </p>
              ) : null}
            </div>
          </div>
          <SavedSearchList searches={serializedSearches} emptyMessage={t("dashboardNoSearches")} />
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("dashboardNewSearch")}</h2>
          <SavedSearchForm />
        </section>
      </main>
    </div>
  );
}

function countConsecutiveFailures(pollRuns: PollRunRecord[]): number {
  let count = 0;

  for (const run of pollRuns) {
    if (run.status !== "FAILED") {
      break;
    }
    count += 1;
  }

  return count;
}
