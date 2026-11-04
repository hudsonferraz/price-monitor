/**
 * Most scrolls a poll may make for a listing limit. Only a safety cap: a poll normally stops
 * sooner, when it has enough listings, Facebook says there are no more, or scrolling goes quiet.
 */
export function getScrollAttemptsForLimit(limit: number): number {
  if (limit <= 12) {
    return 6;
  }

  if (limit <= 24) {
    return 10;
  }

  return 16;
}

/**
 * Scrolls in a row with no new listings before giving up. Facebook sometimes answers a scroll
 * late, or with an empty batch mid-way through the results, so one quiet scroll is not the end.
 */
export const SCROLL_IDLE_LIMIT = 3;

export const MAX_GRAPHQL_RESPONSE_BYTES = 512_000;

export type ScrollStopReason = "limit_reached" | "end_of_results" | "idle" | "max_scrolls";

export interface ScrollState {
  /** Listings collected so far. */
  count: number;
  /** Listings the poll wants. */
  target: number;
  /** Scrolls in a row that brought no new listings. */
  idleScrolls: number;
  /** Scrolls done so far. */
  scrolls: number;
  maxScrolls: number;
  /** Facebook's search data said there is no next page. */
  reachedEnd: boolean;
}

/** Why the scroll loop should stop now, or null to keep scrolling. */
export function getScrollStopReason(state: ScrollState): ScrollStopReason | null {
  if (state.count >= state.target) return "limit_reached";
  if (state.reachedEnd) return "end_of_results";
  if (state.idleScrolls >= SCROLL_IDLE_LIMIT) return "idle";
  if (state.scrolls >= state.maxScrolls) return "max_scrolls";
  return null;
}
