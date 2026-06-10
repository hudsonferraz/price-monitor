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

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

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
  }));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage saved Facebook Marketplace searches. Polling starts in Phase 2.
          </p>
        </div>

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
