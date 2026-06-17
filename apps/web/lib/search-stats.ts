import { prisma, PollRunStatus } from "@price-monitor/database";
import {
  buildSearchStatsSummary,
  type SearchStatsSummary,
} from "@price-monitor/shared/search-stats";

export type { SearchStatsSummary, SearchStatsTimelinePoint } from "@price-monitor/shared/search-stats";

export async function fetchSearchStatsSummaries(userId: string): Promise<SearchStatsSummary[]> {
  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  if (searches.length === 0) {
    return [];
  }

  const pollRuns = await prisma.pollRun.findMany({
    where: {
      savedSearchId: { in: searches.map((search) => search.id) },
      status: PollRunStatus.SUCCESS,
    },
    orderBy: { startedAt: "desc" },
    take: searches.length * 12,
    select: {
      id: true,
      savedSearchId: true,
      startedAt: true,
      listingsFound: true,
      snapshots: {
        select: { priceCents: true },
      },
    },
  });

  const pollRunsBySearchId = new Map<string, typeof pollRuns>();
  for (const pollRun of pollRuns) {
    const existing = pollRunsBySearchId.get(pollRun.savedSearchId) ?? [];
    if (existing.length < 12) {
      existing.push(pollRun);
      pollRunsBySearchId.set(pollRun.savedSearchId, existing);
    }
  }

  return searches
    .map((search) =>
      buildSearchStatsSummary({
        savedSearchId: search.id,
        searchName: search.name,
        pollRuns: pollRunsBySearchId.get(search.id) ?? [],
      }),
    )
    .filter((summary): summary is SearchStatsSummary => summary != null);
}
