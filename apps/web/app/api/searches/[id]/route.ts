import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { cancelPollSearchJob } from "@price-monitor/queue";
import { prisma } from "@price-monitor/database";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  await prisma.savedSearch.update({
    where: { id },
    data: { isEnabled: false },
  });

  const cancelResult = await cancelPollSearchJob(id);

  if (!cancelResult.removed && cancelResult.reason === "active") {
    return apiErrorResponse("SEARCH_DELETE_ACTIVE_POLL", 409);
  }

  if (!cancelResult.removed && cancelResult.reason === "failed") {
    return apiErrorResponse("SEARCH_DELETE_CANCEL_FAILED", 503);
  }

  await prisma.savedSearch.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
