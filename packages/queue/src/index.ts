import { Queue, type Job, type ConnectionOptions } from "bullmq";
import {
  POLL_SEARCH_JOB,
  POLL_SEARCH_QUEUE,
  SCHEDULE_POLLS_JOB,
  SCHEDULE_POLLS_QUEUE,
  SCHEDULER_INTERVAL_MS,
  type PollSearchJobData,
  type PollTrigger,
} from "@price-monitor/shared/queue";

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }
  return redisUrl;
}

export function getRedisConnectionOptions(): ConnectionOptions {
  const redisUrl = getRedisUrl();

  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
    ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
  };
}

let pollSearchQueue: Queue | undefined;

export function getPollSearchQueue(): Queue {
  if (!pollSearchQueue) {
    pollSearchQueue = new Queue(POLL_SEARCH_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
      },
    });
  }

  return pollSearchQueue;
}

export type PollJobState = "active" | "waiting" | "delayed" | "completed" | "failed" | "unknown";

export interface PollQueueContext {
  jobState?: PollJobState;
  isQueued: boolean;
  blockingSavedSearchId?: string;
  waitingPosition?: number;
}

async function removeUnlockedPollJob(job: Job): Promise<boolean> {
  try {
    const state = (await job.getState()) as PollJobState;
    if (state === "active") {
      return false;
    }

    await job.remove();
    return true;
  } catch {
    return false;
  }
}

export type CancelPollSearchJobResult =
  | { removed: true; reason: "not_found" | "removed" }
  | { removed: false; reason: "active" | "failed" };

export async function cancelPollSearchJob(
  savedSearchId: string,
): Promise<CancelPollSearchJobResult> {
  try {
    const queue = getPollSearchQueue();
    const job = await queue.getJob(`poll-${savedSearchId}`);
    if (!job) {
      return { removed: true, reason: "not_found" };
    }

    const state = (await job.getState()) as PollJobState;
    if (state === "active") {
      return { removed: false, reason: "active" };
    }

    const removed = await removeUnlockedPollJob(job);
    return removed ? { removed: true, reason: "removed" } : { removed: false, reason: "failed" };
  } catch {
    return { removed: false, reason: "failed" };
  }
}

export async function enqueuePollSearch(
  savedSearchId: string,
  triggeredBy: PollTrigger,
): Promise<{ queued: boolean; jobId: string; state?: PollJobState }> {
  const queue = getPollSearchQueue();
  const jobId = `poll-${savedSearchId}`;

  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    const state = (await existingJob.getState()) as PollJobState;
    if (state === "active" || state === "waiting" || state === "delayed") {
      return { queued: false, jobId, state };
    }

    await removeUnlockedPollJob(existingJob);
  }

  await queue.add(
    POLL_SEARCH_JOB,
    { savedSearchId, triggeredBy } satisfies PollSearchJobData,
    { jobId },
  );

  return { queued: true, jobId };
}

export async function getPollQueueContext(savedSearchId: string): Promise<PollQueueContext> {
  const queue = getPollSearchQueue();
  const jobId = `poll-${savedSearchId}`;
  const myJob = await queue.getJob(jobId);
  const jobState = myJob ? ((await myJob.getState()) as PollJobState) : undefined;
  const isQueued =
    jobState === "active" || jobState === "waiting" || jobState === "delayed";

  const activeJobs = await queue.getJobs(["active"], 0, 5);
  const blockingActiveJob = activeJobs.find((job) => {
    const data = job.data as PollSearchJobData;
    return data.savedSearchId !== savedSearchId;
  });

  let waitingPosition: number | undefined;
  if (jobState === "waiting" || jobState === "delayed") {
    const waitingJobs = await queue.getJobs(["waiting", "delayed"], 0, 50);
    const index = waitingJobs.findIndex((job) => job.id === jobId);
    waitingPosition = index >= 0 ? index + 1 : undefined;
  }

  return {
    jobState,
    isQueued,
    blockingSavedSearchId: blockingActiveJob
      ? (blockingActiveJob.data as PollSearchJobData).savedSearchId
      : undefined,
    waitingPosition,
  };
}

let schedulePollsQueue: Queue | undefined;

export function getSchedulePollsQueue(): Queue {
  if (!schedulePollsQueue) {
    schedulePollsQueue = new Queue(SCHEDULE_POLLS_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });
  }

  return schedulePollsQueue;
}

export async function registerScheduler(): Promise<void> {
  const queue = getSchedulePollsQueue();

  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === SCHEDULE_POLLS_JOB) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  await queue.add(
    SCHEDULE_POLLS_JOB,
    {},
    {
      repeat: { every: SCHEDULER_INTERVAL_MS },
      jobId: "schedule-polls-repeat",
    },
  );
}

export {
  POLL_SEARCH_JOB,
  POLL_SEARCH_QUEUE,
  SCHEDULE_POLLS_JOB,
  SCHEDULE_POLLS_QUEUE,
} from "@price-monitor/shared/queue";
