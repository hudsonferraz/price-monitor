import { enqueuePollSearch, type PollJobState } from "@price-monitor/queue";
import type { PollTrigger } from "@price-monitor/shared/queue";

export type QueuePollSearchResult = {
  queued: boolean;
  jobId: string;
  state?: PollJobState;
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

  return enqueuePollSearch(savedSearchId, triggeredBy);
}
