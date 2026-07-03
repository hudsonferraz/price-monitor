import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  savedSearch: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pollRun: {
    updateMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
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

vi.mock("../lib/email-notifications", () => ({
  sendNewAlertsEmail: vi.fn(),
}));

import { cleanupStaleRunningPolls, executePollSearch } from "./poll-search.job";

describe("poll-search.job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the saved search no longer exists", async () => {
    prismaMock.savedSearch.findUnique.mockResolvedValue(null);

    await expect(executePollSearch("missing-search-id")).rejects.toThrow(
      "Saved search not found: missing-search-id",
    );
  });

  it("marks stale RUNNING polls as FAILED", async () => {
    prismaMock.pollRun.updateMany.mockResolvedValue({ count: 2 });

    const cleaned = await cleanupStaleRunningPolls();

    expect(cleaned).toBe(2);
    expect(prismaMock.pollRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "RUNNING",
        }),
      }),
    );
  });

  it("scopes stale RUNNING cleanup to one search when requested", async () => {
    prismaMock.pollRun.updateMany.mockResolvedValue({ count: 1 });

    await cleanupStaleRunningPolls("search-123");

    expect(prismaMock.pollRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          savedSearchId: "search-123",
        }),
      }),
    );
  });
});
