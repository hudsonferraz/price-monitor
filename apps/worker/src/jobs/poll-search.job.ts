import { prisma, MarketplaceSource, PollRunStatus } from "@price-monitor/database";
import { DEFAULT_LISTING_LIMIT } from "@price-monitor/shared/queue";
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
    throw new Error(`Saved search not found: ${savedSearchId}`);
  }

  if (!savedSearch.isEnabled) {
    throw new Error(`Saved search is disabled: ${savedSearchId}`);
  }

  const pollRun = await prisma.pollRun.create({
    data: {
      savedSearchId,
      status: PollRunStatus.RUNNING,
    },
  });

  try {
    const listings = await searchMarketplace({
      keywords: savedSearch.keywords,
      minPriceCents: savedSearch.minPriceCents ?? undefined,
      maxPriceCents: savedSearch.maxPriceCents ?? undefined,
      limit: DEFAULT_LISTING_LIMIT,
    });

    const { newAlerts, alertIds } = await persistListingsAndAlerts(
      savedSearch.id,
      savedSearch.userId,
      listings,
    );

    await prisma.pollRun.update({
      where: { id: pollRun.id },
      data: {
        status: PollRunStatus.SUCCESS,
        listingsFound: listings.length,
        newAlerts,
        finishedAt: new Date(),
      },
    });

    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: { lastPolledAt: new Date() },
    });

    let emailSent = false;
    if (newAlerts > 0) {
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

    await prisma.pollRun.update({
      where: { id: pollRun.id },
      data: {
        status: PollRunStatus.FAILED,
        errorMessage,
        finishedAt: new Date(),
      },
    });

    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: { lastPolledAt: new Date() },
    });

    throw error;
  }
}

interface PersistResult {
  newAlerts: number;
  alertIds: string[];
}

async function persistListingsAndAlerts(
  savedSearchId: string,
  userId: string,
  listings: NormalizedListing[],
): Promise<PersistResult> {
  const alertIds: string[] = [];

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

    const existingAlert = await prisma.alert.findUnique({
      where: {
        savedSearchId_listingId: {
          savedSearchId,
          listingId: storedListing.id,
        },
      },
    });

    if (existingAlert) {
      continue;
    }

    const alert = await prisma.alert.create({
      data: {
        userId,
        savedSearchId,
        listingId: storedListing.id,
      },
    });

    alertIds.push(alert.id);
  }

  return {
    newAlerts: alertIds.length,
    alertIds,
  };
}

export async function scheduleDuePolls(): Promise<number> {
  const enabledSearches = await prisma.savedSearch.findMany({
    where: { isEnabled: true },
    select: {
      id: true,
      pollIntervalMin: true,
      lastPolledAt: true,
    },
  });

  const now = Date.now();
  let enqueued = 0;

  for (const search of enabledSearches) {
    const intervalMs = search.pollIntervalMin * 60_000;
    const lastPolledAt = search.lastPolledAt?.getTime() ?? 0;
    const isDue = search.lastPolledAt == null || now - lastPolledAt >= intervalMs;

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
