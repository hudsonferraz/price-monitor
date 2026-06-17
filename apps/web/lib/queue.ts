import {
  enqueuePollSearch,
  getPollQueueContext,
  releaseStaleActivePollJobs,
  type PollJobState,
  type PollQueueContext,
} from "@price-monitor/queue";
import type { PollTrigger } from "@price-monitor/shared/queue";

export type QueuePollSearchResult = {
  queued: boolean;
  jobId: string;
  state?: PollJobState;
  queueContext?: PollQueueContext;
};

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function queuePollSearch(
  savedSearchId: string,
  triggeredBy: PollTrigger,
): Promise<QueuePollSearchResult> {
  if (!isRedisConfigured()) {
    throw new Error("REDIS_URL is not configured. Start the worker with Redis to enable polling.");
  }

  await releaseStaleActivePollJobs();
  const result = await enqueuePollSearch(savedSearchId, triggeredBy);
  const queueContext = await getPollQueueContext(savedSearchId);

  return {
    ...result,
    queueContext,
  };
}

export { getPollQueueContext };
