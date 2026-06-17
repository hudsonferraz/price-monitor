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
export const LISTING_LIMIT_OPTIONS = [12, 24, 48] as const;
export type ListingLimit = (typeof LISTING_LIMIT_OPTIONS)[number];
export const SCHEDULER_INTERVAL_MS = 60_000;
