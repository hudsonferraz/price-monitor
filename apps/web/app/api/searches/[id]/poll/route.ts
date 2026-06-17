import { auth } from "@/auth";
import { queuePollSearch } from "@/lib/queue";
import { wakeWorker } from "@/lib/wake-worker";
import { prisma } from "@price-monitor/database";
import {
  formatPollCooldownMessage,
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

  const cooldownRemainingMs = getPollCooldownRemainingMs(savedSearch.lastAttemptedAt);
  if (cooldownRemainingMs > 0) {
    return NextResponse.json(
      {
        error: formatPollCooldownMessage(cooldownRemainingMs),
        retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
        minPollIntervalMinutes: MIN_MANUAL_POLL_INTERVAL_MS / 60_000,
      },
      { status: 429 },
    );
  }

  try {
    wakeWorker();
    const result = await queuePollSearch(id, "manual");
    const blockingSearch = result.queueContext?.blockingSavedSearchId
      ? await prisma.savedSearch.findUnique({
          where: { id: result.queueContext.blockingSavedSearchId },
          select: { name: true },
        })
      : null;

    const message = formatPollQueueMessage({
      queued: result.queued,
      jobState: result.state ?? result.queueContext?.jobState,
      blockingSearchName: blockingSearch?.name ?? null,
      waitingPosition: result.queueContext?.waitingPosition,
    });

    return NextResponse.json({
      queued: result.queued,
      jobId: result.jobId,
      state: result.state ?? result.queueContext?.jobState,
      blockingSearchName: blockingSearch?.name ?? null,
      waitingPosition: result.queueContext?.waitingPosition ?? null,
      message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue poll";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
