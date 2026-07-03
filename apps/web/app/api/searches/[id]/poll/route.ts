import { auth } from "@/auth";
import { getOwnedBlockingSearchName } from "@/lib/poll-queue-context";
import { getPollQueueContext, queuePollSearch } from "@/lib/queue";
import { prisma } from "@price-monitor/database";
import {
  getPollCooldownRemainingMinutes,
  getPollCooldownRemainingMs,
  MIN_MANUAL_POLL_INTERVAL_MS,
} from "@price-monitor/shared/poll-rate-limit";
import { formatPollQueueMessage } from "@price-monitor/shared/poll-queue-messages";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!savedSearch) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  if (!savedSearch.isEnabled) {
    return NextResponse.json({ error: "Search is disabled" }, { status: 400 });
  }

  const queueContext = await getPollQueueContext(id);
  if (queueContext.isQueued) {
    const { blockingSearchName, waitingForAnotherPoll } = await getOwnedBlockingSearchName(
      queueContext.blockingSavedSearchId,
      session.user.id,
    );

    return NextResponse.json({
      queued: false,
      jobId: `poll-${id}`,
      state: queueContext.jobState,
      blockingSearchName,
      waitingPosition: queueContext.waitingPosition ?? null,
      message: formatPollQueueMessage({
        queued: false,
        jobState: queueContext.jobState,
        blockingSearchName,
        waitingForAnotherPoll,
        waitingPosition: queueContext.waitingPosition,
      }),
    });
  }

  const cooldownRemainingMs = getPollCooldownRemainingMs(savedSearch.lastAttemptedAt);
  if (cooldownRemainingMs > 0) {
    const remainingMinutes = getPollCooldownRemainingMinutes(cooldownRemainingMs);
    return NextResponse.json(
      {
        errorCode: "POLL_COOLDOWN",
        remainingMinutes,
        retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
        minPollIntervalMinutes: MIN_MANUAL_POLL_INTERVAL_MS / 60_000,
      },
      { status: 429 },
    );
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

    const message = formatPollQueueMessage({
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
      message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue poll";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
