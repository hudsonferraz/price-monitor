import { Queue, type ConnectionOptions } from "bullmq";
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
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
      },
    });
  }

  return pollSearchQueue;
}

export type PollJobState = "active" | "waiting" | "delayed" | "completed" | "failed" | "unknown";

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

    await existingJob.remove();
  }

  await queue.add(
    POLL_SEARCH_JOB,
    { savedSearchId, triggeredBy } satisfies PollSearchJobData,
    { jobId },
  );

  return { queued: true, jobId };
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
