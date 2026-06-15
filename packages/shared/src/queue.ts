export const POLL_SEARCH_QUEUE = "poll-search";
export const SCHEDULE_POLLS_QUEUE = "schedule-polls";

export const POLL_SEARCH_JOB = "poll-search";
export const SCHEDULE_POLLS_JOB = "schedule-polls";

export type PollTrigger = "manual" | "scheduler";

export interface PollSearchJobData {
  savedSearchId: string;
  triggeredBy: PollTrigger;
}

export const DEFAULT_LISTING_LIMIT = 24;
export const SCHEDULER_INTERVAL_MS = 60_000;
