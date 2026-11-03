import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { vi } from "vitest";
import { auth } from "@/auth";
import { executePollSearch } from "../../apps/worker/src/jobs/poll-search.job";
import { upsertWorkerHeartbeat } from "../../apps/worker/src/lib/worker-heartbeat";
import { PollRunStatus, prisma } from "@price-monitor/database";
import {
  getPollSearchQueue,
  getRedisConnectionOptions,
  POLL_SEARCH_QUEUE,
} from "@price-monitor/queue";
import { generateMockCatalog } from "@price-monitor/shared/mock-catalog";
import { MIN_MANUAL_POLL_INTERVAL_MS } from "@price-monitor/shared/poll-rate-limit";
import type { PollSearchJobData } from "@price-monitor/shared/queue";
import { normalizeListingLimit } from "@price-monitor/shared/sort-alerts";

/**
 * Same job handler as apps/worker/src/index.ts, minus logging and the scheduler, so tests control
 * exactly which polls run.
 */
export function startPollWorker(): Worker {
  return new Worker(
    POLL_SEARCH_QUEUE,
    async (job) => executePollSearch((job.data as PollSearchJobData).savedSearchId),
    { connection: getRedisConnectionOptions(), concurrency: 1 },
  );
}

export async function closeQueueResources(worker: Worker): Promise<void> {
  await worker.close();
  await getPollSearchQueue().close();
  await prisma.$disconnect();
}

/** The poll API refuses to queue jobs unless a worker heartbeat is fresh. */
export async function markWorkerOnline(): Promise<void> {
  await upsertWorkerHeartbeat(new Date(), "integration-test-worker");
}

export async function createTestUser(label: string) {
  return prisma.user.create({
    data: { email: `${label}-${randomUUID()}@integration.test`, name: label },
  });
}

/** Routes see this user as signed in (the only part of the web stack that is substituted). */
export function signInAs(user: { id: string } | null): void {
  vi.mocked(auth).mockResolvedValue((user ? { user: { id: user.id } } : null) as never);
}

export async function waitFor<T>(
  description: string,
  check: () => Promise<T | null | undefined | false>,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null | undefined | false = null;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}.`);
}

/**
 * Waits until a poll run beyond `previousRunCount` has finished (SUCCESS or FAILED) and its queue
 * job has settled. The worker writes the run to the database a moment before BullMQ marks the job
 * completed; the API treats a still-active job as "already queued".
 */
export async function waitForPollToFinish(savedSearchId: string, previousRunCount: number) {
  const run = await waitFor(`poll run #${previousRunCount + 1} of ${savedSearchId} to finish`, async () => {
    const runs = await prisma.pollRun.findMany({
      where: { savedSearchId, status: { not: PollRunStatus.RUNNING } },
      orderBy: { startedAt: "asc" },
    });
    return runs.length > previousRunCount ? runs[runs.length - 1] : null;
  });
  await waitFor(`the queue job of ${savedSearchId} to settle`, async () => {
    const state = await (await getPollSearchQueue().getJob(`poll-${savedSearchId}`))?.getState();
    return state !== "active" && state !== "waiting" && state !== "delayed";
  });
  return run;
}

/** Moves the last manual poll attempt back past the cooldown, instead of waiting 15 minutes. */
export async function allowAnotherPoll(savedSearchId: string): Promise<void> {
  await prisma.savedSearch.update({
    where: { id: savedSearchId },
    data: { lastAttemptedAt: new Date(Date.now() - MIN_MANUAL_POLL_INTERVAL_MS - 1_000) },
  });
}

/** What the mock marketplace returns for this search at a given successful-poll count. */
export function expectedCatalog(
  search: {
    id: string;
    keywords: string;
    minPriceCents: number | null;
    maxPriceCents: number | null;
    listingLimit: number;
  },
  pollSequence: number,
) {
  return generateMockCatalog({
    seed: search.id,
    keywords: search.keywords,
    pollSequence,
    minPriceCents: search.minPriceCents ?? undefined,
    maxPriceCents: search.maxPriceCents ?? undefined,
    limit: normalizeListingLimit(search.listingLimit),
  });
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}
