import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { prisma } from "@price-monitor/database";
import { isExcludedTitle } from "@price-monitor/shared/exclusions";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id: savedSearchId } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id: savedSearchId, userId: session.user.id },
  });

  if (!savedSearch) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  // "Clear all" dismisses what the user sees: alerts hidden by exclusions are left alone so they
  // reappear if the exclusion is removed.
  const openAlerts = await prisma.alert.findMany({
    where: { savedSearchId, userId: session.user.id, dismissedAt: null },
    select: { id: true, listing: { select: { title: true } } },
  });
  const visibleIds = openAlerts
    .filter((alert) => !isExcludedTitle(alert.listing.title, savedSearch.excludeKeywords))
    .map((alert) => alert.id);

  const result = await prisma.alert.updateMany({
    where: { id: { in: visibleIds }, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ dismissed: result.count });
}
