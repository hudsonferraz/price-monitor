import { AlertsFeed, type AlertRecord } from "@/components/alerts-feed";
import type { PollRunRecord } from "@/components/poll-run-history";
import { SiteHeader } from "@/components/site-header";
import { SavedSearchForm, SavedSearchList, type SavedSearchRecord } from "@/components/saved-search-panel";
import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [searches, alerts, pollRuns] = await Promise.all([
    prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.alert.findMany({
      where: { userId: session.user.id },
      include: {
        listing: true,
        savedSearch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.pollRun.findMany({
      where: { savedSearch: { userId: session.user.id } },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
  ]);

  const pollRunsBySearchId = new Map<string, PollRunRecord[]>();

  for (const run of pollRuns) {
    const existing = pollRunsBySearchId.get(run.savedSearchId) ?? [];
    if (existing.length < 3) {
      existing.push({
        id: run.id,
        status: run.status,
        listingsFound: run.listingsFound,
        newAlerts: run.newAlerts,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      });
      pollRunsBySearchId.set(run.savedSearchId, existing);
    }
  }

  const serializedSearches: SavedSearchRecord[] = searches.map((search) => ({
    id: search.id,
    name: search.name,
    keywords: search.keywords,
    minPriceCents: search.minPriceCents,
    maxPriceCents: search.maxPriceCents,
    pollIntervalMin: search.pollIntervalMin,
    isEnabled: search.isEnabled,
    lastPolledAt: search.lastPolledAt?.toISOString() ?? null,
    createdAt: search.createdAt.toISOString(),
    updatedAt: search.updatedAt.toISOString(),
    recentPollRuns: pollRunsBySearchId.get(search.id) ?? [],
  }));

  const serializedAlerts: AlertRecord[] = alerts.map((alert) => ({
    id: alert.id,
    createdAt: alert.createdAt.toISOString(),
    savedSearch: alert.savedSearch,
    listing: {
      id: alert.listing.id,
      source: alert.listing.source,
      title: alert.listing.title,
      priceCents: alert.listing.priceCents,
      currency: alert.listing.currency,
      url: alert.listing.url,
      imageUrl: alert.listing.imageUrl,
      location: alert.listing.location,
    },
  }));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Monitor Facebook Marketplace searches and review new listing alerts.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Alerts</h2>
          <AlertsFeed alerts={serializedAlerts} />
        </section>

        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Your searches</h2>
          <SavedSearchList searches={serializedSearches} />
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 text-lg font-semibold">New search</h2>
          <SavedSearchForm />
        </section>
      </main>
    </div>
  );
}
