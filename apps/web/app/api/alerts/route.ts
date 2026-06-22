import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { parsePaginationLimit } from "@price-monitor/shared/pagination";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      savedSearch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    alerts.map((alert) => ({
      id: alert.id,
      createdAt: alert.createdAt.toISOString(),
      savedSearch: alert.savedSearch,
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
