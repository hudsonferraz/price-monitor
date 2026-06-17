import { prisma } from "@price-monitor/database";
import { cancelPollSearchJob, getPollSearchQueue, releaseStaleActivePollJobs } from "@price-monitor/queue";
import type { PollSearchJobData } from "@price-monitor/shared/queue";

export async function cleanupPollJobs(): Promise<{ staleReleased: number; orphansRemoved: number }> {
  const staleReleased = await releaseStaleActivePollJobs();

  const queue = getPollSearchQueue();
  const activeJobs = await queue.getJobs(["active", "waiting", "delayed"], 0, 50);
  let orphansRemoved = 0;

  for (const job of activeJobs) {
    const data = job.data as PollSearchJobData;
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id: data.savedSearchId },
      select: { id: true, isEnabled: true },
    });

    if (!savedSearch || !savedSearch.isEnabled) {
      await job.remove();
      orphansRemoved += 1;
    }
  }

  return { staleReleased, orphansRemoved };
}

export async function removePollJobForSearch(savedSearchId: string): Promise<void> {
  await cancelPollSearchJob(savedSearchId);
}
