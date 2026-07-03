import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { prisma } from "@price-monitor/database";
import { parsePaginationLimit } from "@price-monitor/shared/pagination";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = parsePaginationLimit(searchParams.get("limit"), {
    defaultLimit: 10,
    maxLimit: 50,
  });

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!savedSearch) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  const pollRuns = await prisma.pollRun.findMany({
    where: { savedSearchId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    pollRuns.map((run) => ({
      id: run.id,
      status: run.status,
      listingsFound: run.listingsFound,
      newAlerts: run.newAlerts,
      errorMessage: run.errorMessage,
      durationMs: run.durationMs,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
  );
}
