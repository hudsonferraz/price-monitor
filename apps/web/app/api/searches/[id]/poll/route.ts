import { auth } from "@/auth";
import { queuePollSearch } from "@/lib/queue";
import { wakeWorker } from "@/lib/wake-worker";
import { prisma } from "@price-monitor/database";
import type { PollJobState } from "@price-monitor/queue";
import {
  formatPollCooldownMessage,
  getPollCooldownRemainingMs,
  MIN_MANUAL_POLL_INTERVAL_MS,
} from "@price-monitor/shared/poll-rate-limit";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function formatPollQueueMessage(queued: boolean, state?: PollJobState): string {
  if (queued) {
    return "Poll queued. The worker may take up to a minute to start, then results will appear shortly.";
  }

  if (state === "active") {
    return "A poll is already running for this search.";
  }

  if (state === "waiting" || state === "delayed") {
    return "A poll is already queued. The worker may take up to a minute to start on the free tier.";
  }

  return "A poll is already in progress for this search.";
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

  const cooldownRemainingMs = getPollCooldownRemainingMs(savedSearch.lastPolledAt);
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
    return NextResponse.json({
      queued: result.queued,
      jobId: result.jobId,
      state: result.state,
      message: formatPollQueueMessage(result.queued, result.state),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue poll";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
