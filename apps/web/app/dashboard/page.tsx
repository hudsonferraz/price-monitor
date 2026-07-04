import { type AlertRecord } from "@/components/alerts-feed";
import { PollDiagnosticsPanel } from "@/components/poll-diagnostics-panel";
import {
  WorkerStatusCard,
  type WorkerActivitySummary,
  type WorkerHeartbeatRecord,
} from "@/components/worker-status-card";
import { MarketplaceLocationHint } from "@/components/marketplace-location-hint";
import type { PollRunRecord } from "@/components/poll-run-history";
import { SavedSearchForm, SavedSearchList, type SavedSearchRecord } from "@/components/saved-search-panel";
import { auth } from "@/auth";
import { formatSearchSummary, getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";
import { summarizeRecentPollHealth } from "@/lib/system-health";
import { getPollIssueCode, isFacebookSessionError } from "@price-monitor/shared/poll-errors";
import {
  computeDealQualitySignals,
  groupSnapshotPricesByListing,
} from "@price-monitor/shared/deal-quality";
import { PollRunStatus, prisma } from "@price-monitor/database";
import { redirect } from "next/navigation";

function serializePollRun(run: {
  id: string;
  status: PollRunStatus;
  listingsFound: number;
  newAlerts: number;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}): PollRunRecord {
  return {
    id: run.id,
    status: run.status,
    listingsFound: run.listingsFound,
    newAlerts: run.newAlerts,
    errorMessage: run.errorMessage,
    durationMs: run.durationMs,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const locale = await getLocale();
  const t = await getTranslator(locale);

  const [searches, pollRunsForHealth, latestWorkerHeartbeat, snapshotPrices] = await Promise.all([
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
        pollRuns: {
          orderBy: { startedAt: "desc" },
          take: 20,
        },
        _count: {
          select: {
            pollRuns: { where: { status: PollRunStatus.SUCCESS } },
          },
        },
      },
    }),
    prisma.pollRun.findMany({
      where: { savedSearch: { userId: session.user.id } },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    prisma.workerHeartbeat.findFirst({
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.pollSnapshotListing.findMany({
      where: {
        pollRun: {
          savedSearch: { userId: session.user.id },
        },
      },
      select: {
        listingId: true,
        priceCents: true,
        pollRun: { select: { savedSearchId: true } },
      },
    }),
  ]);

  const snapshotPricesByListing = groupSnapshotPricesByListing(
    snapshotPrices.map((snapshot) => ({
      listingId: snapshot.listingId,
      priceCents: snapshot.priceCents,
      savedSearchId: snapshot.pollRun.savedSearchId,
    })),
  );

  const pollHealth = summarizeRecentPollHealth(pollRunsForHealth);

  const serializedSearches: SavedSearchRecord[] = searches.map((search) => {
    const recentPollRuns = search.pollRuns.slice(0, 3).map(serializePollRun);
    const latestSuccessRun = search.pollRuns.find((run) => run.status === PollRunStatus.SUCCESS);
    const latestFailedRun = search.pollRuns.find((run) => run.status === PollRunStatus.FAILED);
    const alerts: AlertRecord[] = search.alerts.map((alert) => {
      const snapshotPricesForListing =
        snapshotPricesByListing.get(`${search.id}:${alert.listingId}`) ?? [];
      const dealQuality = computeDealQualitySignals({
        currentPriceCents: alert.listing.priceCents,
        snapshotPricesCents: snapshotPricesForListing,
      });

      return {
        id: alert.id,
        createdAt: alert.createdAt.toISOString(),
        previousPriceCents: alert.previousPriceCents,
        priceDroppedAt: alert.priceDroppedAt?.toISOString() ?? null,
        savedSearch: { id: search.id, name: search.name },
        dealQuality: {
          isLowestSeen: dealQuality.isLowestSeen,
          isBelowRecentAverage: dealQuality.isBelowRecentAverage,
          recentAverageCents: dealQuality.recentAverageCents,
        },
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
      };
    });

    const lastSuccessfulPollAt = search.lastSuccessfulPollAt?.toISOString() ?? null;
    const latestPollStartedAt = latestSuccessRun?.startedAt.toISOString() ?? null;
    const showLastFailureMessage =
      search.consecutiveFailures > 0 &&
      latestFailedRun != null &&
      (lastSuccessfulPollAt == null ||
        latestFailedRun.startedAt.getTime() >= new Date(lastSuccessfulPollAt).getTime());

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
      lastSuccessfulPollAt,
      createdAt: search.createdAt.toISOString(),
      updatedAt: search.updatedAt.toISOString(),
      recentPollRuns,
      alerts,
      latestPollStartedAt,
      isFirstPollResults:
        search._count.pollRuns === 1 && lastSuccessfulPollAt != null && alerts.length > 0,
      reliability: {
        consecutiveFailures: search.consecutiveFailures,
        lastFailureMessage: showLastFailureMessage ? latestFailedRun.errorMessage : null,
        hasFacebookSessionFailure:
          search.consecutiveFailures > 0 &&
          latestFailedRun != null &&
          isFacebookSessionError(latestFailedRun.errorMessage),
      },
    };
  });

  const totalListings = serializedSearches.reduce((sum, search) => sum + search.alerts.length, 0);
  const latestSuccessfulPoll = pollRunsForHealth.find((run) => run.status === PollRunStatus.SUCCESS) ?? null;
  const latestFailedPoll = pollRunsForHealth.find((run) => run.status === PollRunStatus.FAILED) ?? null;
  const workerActivity: WorkerActivitySummary = {
    latestSuccess: latestSuccessfulPoll
      ? {
          startedAt: latestSuccessfulPoll.startedAt.toISOString(),
          listingsFound: latestSuccessfulPoll.listingsFound,
          newAlerts: latestSuccessfulPoll.newAlerts,
          durationMs: latestSuccessfulPoll.durationMs,
        }
      : null,
    latestFailure: latestFailedPoll
      ? {
          startedAt: latestFailedPoll.startedAt.toISOString(),
          issueCode: getPollIssueCode(latestFailedPoll.errorMessage),
          errorMessage: latestFailedPoll.errorMessage,
        }
      : null,
    failedPollCount24h: pollHealth.failedPollCount24h,
    averageDurationMs: pollHealth.averageDurationMs,
  };
  const workerHeartbeat: WorkerHeartbeatRecord | null = latestWorkerHeartbeat
    ? {
        workerId: latestWorkerHeartbeat.workerId,
        status: latestWorkerHeartbeat.status,
        hostname: latestWorkerHeartbeat.hostname,
        pid: latestWorkerHeartbeat.pid,
        startedAt: latestWorkerHeartbeat.startedAt.toISOString(),
        lastSeenAt: latestWorkerHeartbeat.lastSeenAt.toISOString(),
        facebookSessionStatus: latestWorkerHeartbeat.facebookSessionStatus,
        facebookSessionMode: latestWorkerHeartbeat.facebookSessionMode,
        facebookSessionMessage: latestWorkerHeartbeat.facebookSessionMessage,
      }
    : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t("dashboardTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("dashboardDescription")}</p>
        </div>


        <WorkerStatusCard heartbeat={workerHeartbeat} activity={workerActivity} />

        <PollDiagnosticsPanel
          latestIssueCode={pollHealth.latestIssueCode}
          failedPollCount24h={pollHealth.failedPollCount24h}
        />

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
