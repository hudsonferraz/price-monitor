import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { getOwnedBlockingSearchName } from "@/lib/poll-queue-context";
import { getPollQueueContext, isRedisConfigured } from "@/lib/queue";
import { prisma } from "@price-monitor/database";
import { formatPollQueueMessage } from "@price-monitor/shared/poll-queue-messages";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true },
  });

  if (!savedSearch) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  if (!isRedisConfigured()) {
    return apiErrorResponse("REDIS_NOT_CONFIGURED", 503);
  }

  const queueContext = await getPollQueueContext(id);
  const { blockingSearchName, waitingForAnotherPoll } = await getOwnedBlockingSearchName(
    queueContext.blockingSavedSearchId,
    session.user.id,
  );

  const message = formatPollQueueMessage({
    queued: queueContext.isQueued,
    jobState: queueContext.jobState,
    blockingSearchName,
    waitingForAnotherPoll,
    waitingPosition: queueContext.waitingPosition,
  });

  return NextResponse.json({
    jobState: queueContext.jobState,
    isQueued: queueContext.isQueued,
    waitingPosition: queueContext.waitingPosition,
    blockingSearchName,
    message,
  });
}
