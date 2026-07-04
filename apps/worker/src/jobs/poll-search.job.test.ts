import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  savedSearch: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pollRun: {
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  PollRunStatus: {
    RUNNING: "RUNNING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
  },
  MarketplaceSource: { FACEBOOK: "FACEBOOK" },
  prisma: prismaMock,
}));

vi.mock("../lib/marketplace-browser", () => ({
  searchMarketplace: vi.fn(),
}));


import { cleanupStaleRunningPolls, executePollSearch, STALE_RUNNING_POLL_MS } from "./poll-search.job";

describe("poll-search.job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => {
      await Promise.all(operations);
    });
  });

  it("throws when the saved search no longer exists", async () => {
    prismaMock.savedSearch.findUnique.mockResolvedValue(null);

    await expect(executePollSearch("missing-search-id")).rejects.toThrow(
      "Saved search not found: missing-search-id",
    );
  });

  it("marks stale RUNNING polls as FAILED and increments search failures", async () => {
    const startedAt = new Date(Date.now() - STALE_RUNNING_POLL_MS - 1_000);
    prismaMock.pollRun.findMany.mockResolvedValue([
      { id: "run-1", savedSearchId: "search-1", startedAt },
      { id: "run-2", savedSearchId: "search-2", startedAt },
    ]);

    const cleaned = await cleanupStaleRunningPolls();

    expect(cleaned).toBe(2);
    expect(prismaMock.pollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RUNNING",
        }),
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.savedSearch.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: {
        lastAttemptedAt: expect.any(Date),
        consecutiveFailures: { increment: 1 },
      },
    });
    expect(prismaMock.savedSearch.update).toHaveBeenCalledWith({
      where: { id: "search-2" },
      data: {
        lastAttemptedAt: expect.any(Date),
        consecutiveFailures: { increment: 1 },
      },
    });
  });

  it("scopes stale RUNNING cleanup to one search when requested", async () => {
    prismaMock.pollRun.findMany.mockResolvedValue([]);

    await cleanupStaleRunningPolls("search-123");

    expect(prismaMock.pollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          savedSearchId: "search-123",
        }),
      }),
    );
  });
});
