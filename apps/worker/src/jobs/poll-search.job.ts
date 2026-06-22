import { prisma, MarketplaceSource, PollRunStatus } from "@price-monitor/database";
import { normalizeListingLimit } from "@price-monitor/shared/sort-alerts";
import { hasPriceDropped } from "@price-monitor/shared/price-drop";
import type { NormalizedListing } from "@price-monitor/shared/types";
import { sendNewAlertsEmail } from "../lib/email-notifications";
import { searchMarketplace } from "../lib/marketplace-browser";

export interface PollSearchResult {
  pollRunId: string;
  listingsFound: number;
  newAlerts: number;
  emailSent: boolean;
}

export async function executePollSearch(savedSearchId: string): Promise<PollSearchResult> {
  const savedSearch = await prisma.savedSearch.findUnique({
    where: { id: savedSearchId },
  });

  if (!savedSearch) {
    console.warn(`Skipping poll for missing search: ${savedSearchId}`);
    return {
      pollRunId: "",
      listingsFound: 0,
      newAlerts: 0,
      emailSent: false,
    };
  }

  if (!savedSearch.isEnabled) {
    throw new Error(`Saved search is disabled: ${savedSearchId}`);
  }

  await prisma.pollRun.updateMany({
    where: {
      savedSearchId,
      status: PollRunStatus.RUNNING,
      startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: {
      status: PollRunStatus.FAILED,
      errorMessage: "Poll timed out before completing.",
      finishedAt: new Date(),
    },
  });

  const successfulPollCountBeforeRun = await prisma.pollRun.count({
    where: {
      savedSearchId,
      status: PollRunStatus.SUCCESS,
    },
  });
  const isBaselinePoll = successfulPollCountBeforeRun === 0;

  const pollRun = await prisma.pollRun.create({
    data: {
      savedSearchId,
      status: PollRunStatus.RUNNING,
    },
  });

  const pollStartedAt = Date.now();

  try {
    const listings = await searchMarketplace({
      keywords: savedSearch.keywords,
      minPriceCents: savedSearch.minPriceCents ?? undefined,
      maxPriceCents: savedSearch.maxPriceCents ?? undefined,
      limit: normalizeListingLimit(savedSearch.listingLimit),
    });

    const { newAlerts, alertIds } = await persistListingsAndAlerts(
      savedSearch.id,
      savedSearch.userId,
      pollRun.id,
      listings,
      isBaselinePoll,
    );

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - pollStartedAt;

    await prisma.pollRun.update({
      where: { id: pollRun.id },
      data: {
        status: PollRunStatus.SUCCESS,
        listingsFound: listings.length,
        newAlerts,
        finishedAt,
        durationMs,
      },
    });

    console.log(
      `[poll] savedSearchId=${savedSearchId} status=SUCCESS durationMs=${durationMs} listings=${listings.length} newAlerts=${newAlerts}`,
    );

    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: {
        lastAttemptedAt: finishedAt,
        lastSuccessfulPollAt: finishedAt,
      },
    });

    let emailSent = false;
    if (newAlerts > 0 && !isBaselinePoll) {
      try {
        emailSent = await sendNewAlertsEmail(savedSearch.userId, savedSearch.id, alertIds);
      } catch (error) {
        console.error("Failed to send alert email:", error instanceof Error ? error.message : error);
      }
    }

    return {
      pollRunId: pollRun.id,
      listingsFound: listings.length,
      newAlerts,
      emailSent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown poll error";
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - pollStartedAt;

    await prisma.pollRun.update({
      where: { id: pollRun.id },
      data: {
        status: PollRunStatus.FAILED,
        errorMessage,
        finishedAt,
        durationMs,
      },
    });

    console.error(
      `[poll] savedSearchId=${savedSearchId} status=FAILED durationMs=${durationMs} error=${errorMessage}`,
    );

    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: { lastAttemptedAt: finishedAt },
    });

    throw error;
  }
}

interface PersistResult {
  newAlerts: number;
  alertIds: string[];
}

async function getLatestSnapshotPricesByListingId(
  savedSearchId: string,
  listingIds: string[],
  excludePollRunId: string,
): Promise<Map<string, number | null>> {
  if (listingIds.length === 0) {
    return new Map();
  }

  const snapshots = await prisma.pollSnapshotListing.findMany({
    where: {
      listingId: { in: listingIds },
      pollRun: {
        savedSearchId,
        id: { not: excludePollRunId },
      },
    },
    select: {
      listingId: true,
      priceCents: true,
      pollRun: { select: { startedAt: true } },
    },
    orderBy: { pollRun: { startedAt: "desc" } },
  });

  const latestByListingId = new Map<string, number | null>();

  for (const snapshot of snapshots) {
    if (!latestByListingId.has(snapshot.listingId)) {
      latestByListingId.set(snapshot.listingId, snapshot.priceCents);
    }
  }

  return latestByListingId;
}

async function persistListingsAndAlerts(
  savedSearchId: string,
  userId: string,
  pollRunId: string,
  listings: NormalizedListing[],
  isBaselinePoll: boolean,
): Promise<PersistResult> {
  const alertIds: string[] = [];
  const snapshotEntries: Array<{
    pollRunId: string;
    listingId: string;
    priceCents: number | null;
  }> = [];

  const existingListings = await prisma.listing.findMany({
    where: {
      source: MarketplaceSource.FACEBOOK,
      externalId: { in: listings.map((listing) => listing.externalId) },
    },
    select: { id: true },
  });
  const latestSnapshotPrices = await getLatestSnapshotPricesByListingId(
    savedSearchId,
    existingListings.map((listing) => listing.id),
    pollRunId,
  );

  for (const listing of listings) {
    const storedListing = await prisma.listing.upsert({
      where: {
        source_externalId: {
          source: MarketplaceSource.FACEBOOK,
          externalId: listing.externalId,
        },
      },
      create: {
        source: MarketplaceSource.FACEBOOK,
        externalId: listing.externalId,
        title: listing.title,
        priceCents: listing.priceCents,
        currency: listing.currency,
        url: listing.url,
        imageUrl: listing.imageUrl,
        location: listing.location,
      },
      update: {
        title: listing.title,
        priceCents: listing.priceCents,
        currency: listing.currency,
        url: listing.url,
        imageUrl: listing.imageUrl,
        location: listing.location,
      },
    });

    const previousPriceCents = latestSnapshotPrices.get(storedListing.id) ?? null;

    snapshotEntries.push({
      pollRunId,
      listingId: storedListing.id,
      priceCents: listing.priceCents,
    });

    const existingAlert = await prisma.alert.findUnique({
      where: {
        savedSearchId_listingId: {
          savedSearchId,
          listingId: storedListing.id,
        },
      },
    });

    if (existingAlert?.dismissedAt) {
      continue;
    }

    const priceDropped = hasPriceDropped(previousPriceCents, listing.priceCents);

    if (!existingAlert) {
      const alert = await prisma.alert.create({
        data: {
          userId,
          savedSearchId,
          listingId: storedListing.id,
          seenAt: isBaselinePoll ? new Date() : null,
        },
      });

      if (!isBaselinePoll) {
        alertIds.push(alert.id);
      }
      continue;
    }

    if (priceDropped) {
      await prisma.alert.update({
        where: { id: existingAlert.id },
        data: {
          previousPriceCents,
          priceDroppedAt: new Date(),
          emailSentAt: null,
          seenAt: null,
        },
      });

      alertIds.push(existingAlert.id);
      continue;
    }

    await prisma.alert.update({
      where: { id: existingAlert.id },
      data: { seenAt: new Date() },
    });
  }

  if (snapshotEntries.length > 0) {
    await prisma.pollSnapshotListing.createMany({
      data: snapshotEntries,
      skipDuplicates: true,
    });
  }

  return {
    newAlerts: alertIds.length,
    alertIds,
  };
}

export async function scheduleDuePolls(): Promise<number> {
  const { cleanupPollJobs } = await import("../lib/poll-job-cleanup.js");
  const cleanup = await cleanupPollJobs();
  if (cleanup.staleReleased > 0 || cleanup.orphansRemoved > 0) {
    console.log(
      `[scheduler] cleaned poll queue: ${cleanup.staleReleased} stale, ${cleanup.orphansRemoved} orphan job(s)`,
    );
  }

  const enabledSearches = await prisma.savedSearch.findMany({
    where: { isEnabled: true },
    select: {
      id: true,
      pollIntervalMin: true,
      lastSuccessfulPollAt: true,
    },
  });

  const now = Date.now();
  let enqueued = 0;

  for (const search of enabledSearches) {
    const intervalMs = search.pollIntervalMin * 60_000;
    const lastSuccessfulPollAt = search.lastSuccessfulPollAt?.getTime() ?? 0;
    const isDue =
      search.lastSuccessfulPollAt == null || now - lastSuccessfulPollAt >= intervalMs;

    if (!isDue) {
      continue;
    }

    const { enqueuePollSearch } = await import("@price-monitor/queue");
    const result = await enqueuePollSearch(search.id, "scheduler");
    if (result.queued) {
      enqueued += 1;
    }
  }

  return enqueued;
}
