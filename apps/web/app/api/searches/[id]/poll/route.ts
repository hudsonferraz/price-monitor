import { auth } from "@/auth";
import { apiErrorResponse } from "@/lib/api-responses";
import { getOwnedBlockingSearchName } from "@/lib/poll-queue-context";
import { getPollQueueContext, queuePollSearch } from "@/lib/queue";
import { getLatestWorkerState } from "@/lib/worker-health";
import { prisma } from "@price-monitor/database";
import {
  getPollCooldownRemainingMinutes,
  getPollCooldownRemainingMs,
  MIN_MANUAL_POLL_INTERVAL_MS,
} from "@price-monitor/shared/poll-rate-limit";
import { resolvePollQueueMessage } from "@price-monitor/shared/poll-queue-messages";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrorResponse("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!savedSearch) {
    return apiErrorResponse("SEARCH_NOT_FOUND", 404);
  }

  if (!savedSearch.isEnabled) {
    return apiErrorResponse("SEARCH_DISABLED", 400);
  }

  const queueContext = await getPollQueueContext(id);
  if (queueContext.isQueued) {
    const { blockingSearchName, waitingForAnotherPoll } = await getOwnedBlockingSearchName(
      queueContext.blockingSavedSearchId,
      session.user.id,
    );

    const queueMessage = resolvePollQueueMessage({
      queued: false,
      jobState: queueContext.jobState,
      blockingSearchName,
      waitingForAnotherPoll,
      waitingPosition: queueContext.waitingPosition,
    });

    return NextResponse.json({
      queued: false,
      jobId: `poll-${id}`,
      state: queueContext.jobState,
      blockingSearchName,
      waitingPosition: queueContext.waitingPosition ?? null,
      ...queueMessage,
    });
  }

  const cooldownRemainingMs = getPollCooldownRemainingMs(savedSearch.lastAttemptedAt);
  if (cooldownRemainingMs > 0) {
    const remainingMinutes = getPollCooldownRemainingMinutes(cooldownRemainingMs);
    return apiErrorResponse("POLL_COOLDOWN", 429, {
      remainingMinutes,
      retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
      minPollIntervalMinutes: MIN_MANUAL_POLL_INTERVAL_MS / 60_000,
    });
  }

  const workerState = await getLatestWorkerState();
  if (workerState === "missing" || workerState === "offline") {
    return apiErrorResponse("WORKER_OFFLINE", 503);
  }

  if (workerState === "stale") {
    return apiErrorResponse("WORKER_STALE", 503);
  }

  try {
    const result = await queuePollSearch(id, "manual");
    if (result.queued) {
      await prisma.savedSearch.update({
        where: { id },
        data: { lastAttemptedAt: new Date() },
      });
    }

    const { blockingSearchName, waitingForAnotherPoll } = await getOwnedBlockingSearchName(
      result.queueContext?.blockingSavedSearchId,
      session.user.id,
    );

    const queueMessage = resolvePollQueueMessage({
      queued: result.queued,
      jobState: result.state ?? result.queueContext?.jobState,
      blockingSearchName,
      waitingForAnotherPoll,
      waitingPosition: result.queueContext?.waitingPosition,
    });

    return NextResponse.json({
      queued: result.queued,
      jobId: result.jobId,
      state: result.state ?? result.queueContext?.jobState,
      blockingSearchName,
      waitingPosition: result.queueContext?.waitingPosition ?? null,
      ...queueMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("REDIS_URL")) {
      return apiErrorResponse("REDIS_NOT_CONFIGURED", 503);
    }

    return apiErrorResponse("POLL_QUEUE_FAILED", 503);
  }
}
