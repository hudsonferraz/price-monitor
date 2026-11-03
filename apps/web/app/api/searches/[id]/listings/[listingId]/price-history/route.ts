import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { prisma } from "@price-monitor/database";
import { getDealQualityHistoryCutoff } from "@price-monitor/shared/deal-quality";
import { buildPriceSeries } from "@price-monitor/shared/price-history";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string; listingId: string }>;
}

/** Full price history of one listing as observed by one of the user's saved searches. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id, listingId } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!savedSearch) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  // Same window and scoping as the dashboard trend and the deal-quality badges.
  const snapshots = await prisma.pollSnapshotListing.findMany({
    where: {
      listingId,
      pollRun: {
        savedSearchId: savedSearch.id,
        startedAt: { gte: getDealQualityHistoryCutoff() },
      },
    },
    select: {
      priceCents: true,
      pollRun: { select: { startedAt: true } },
    },
    orderBy: { pollRun: { startedAt: "asc" } },
  });

  return NextResponse.json({
    points: buildPriceSeries(
      snapshots.map((snapshot) => ({
        priceCents: snapshot.priceCents,
        observedAt: snapshot.pollRun.startedAt,
      })),
    ),
  });
}
