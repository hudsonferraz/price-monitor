import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { prisma } from "@price-monitor/database";
import { parsePaginationLimit } from "@price-monitor/shared/pagination";
import { isExcludedTitle } from "@price-monitor/shared/exclusions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { searchParams } = new URL(request.url);
  const limit = parsePaginationLimit(searchParams.get("limit"), {
    defaultLimit: 50,
    maxLimit: 100,
  });
  const savedSearchId = searchParams.get("savedSearchId");

  const alerts = await prisma.alert.findMany({
    where: {
      userId: session.user.id,
      dismissedAt: null,
      ...(savedSearchId ? { savedSearchId } : {}),
    },
    include: {
      listing: true,
      savedSearch: { select: { id: true, name: true, excludeKeywords: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // Alerts matching the search's current exclusions stay hidden (they come back if removed).
  const visibleAlerts = alerts.filter(
    (alert) => !isExcludedTitle(alert.listing.title, alert.savedSearch.excludeKeywords),
  );

  return NextResponse.json(
    visibleAlerts.map((alert) => ({
      id: alert.id,
      createdAt: alert.createdAt.toISOString(),
      savedSearch: { id: alert.savedSearch.id, name: alert.savedSearch.name },
      listing: {
        id: alert.listing.id,
        source: alert.listing.source,
        externalId: alert.listing.externalId,
        title: alert.listing.title,
        priceCents: alert.listing.priceCents,
        currency: alert.listing.currency,
        url: alert.listing.url,
        imageUrl: alert.listing.imageUrl,
        location: alert.listing.location,
      },
    })),
  );
}
