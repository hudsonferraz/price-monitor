import { prisma } from "@price-monitor/database";

export async function getOwnedBlockingSearchName(
  blockingSavedSearchId: string | undefined,
  userId: string,
): Promise<{ blockingSearchName: string | null; waitingForAnotherPoll: boolean }> {
  if (!blockingSavedSearchId) {
    return { blockingSearchName: null, waitingForAnotherPoll: false };
  }

  const blockingSearch = await prisma.savedSearch.findFirst({
    where: { id: blockingSavedSearchId, userId },
    select: { name: true },
  });

  return {
    blockingSearchName: blockingSearch?.name ?? null,
    waitingForAnotherPoll: true,
  };
}
