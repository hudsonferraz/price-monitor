import { prisma } from "@price-monitor/database";
import { cancelPollSearchJob, getPollSearchQueue } from "@price-monitor/queue";
import type { PollSearchJobData } from "@price-monitor/shared/queue";

export async function cleanupPollJobs(): Promise<{
  orphansRemoved: number;
  activeJobsLeftRunning: number;
}> {
  const queue = getPollSearchQueue();
  const queuedJobs = await queue.getJobs(["waiting", "delayed"], 0, 50);
  let orphansRemoved = 0;

  for (const job of queuedJobs) {
    const data = job.data as PollSearchJobData;
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id: data.savedSearchId },
      select: { id: true, isEnabled: true },
    });

    if (!savedSearch || !savedSearch.isEnabled) {
      const result = await cancelPollSearchJob(data.savedSearchId);
      if (result.removed) {
        orphansRemoved += 1;
      }
    }
  }

  const activeJobs = await queue.getJobs(["active"], 0, 50);
  let activeJobsLeftRunning = 0;

  for (const job of activeJobs) {
    const data = job.data as PollSearchJobData;
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id: data.savedSearchId },
      select: { id: true, isEnabled: true },
    });

    if (!savedSearch || !savedSearch.isEnabled) {
      activeJobsLeftRunning += 1;
    }
  }

  return { orphansRemoved, activeJobsLeftRunning };
}

export async function removePollJobForSearch(savedSearchId: string): Promise<void> {
  await cancelPollSearchJob(savedSearchId);
}
