import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    savedSearch: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  getPollQueueContext: vi.fn(),
  queuePollSearch: vi.fn(),
}));

vi.mock("@/lib/poll-queue-context", () => ({
  getOwnedBlockingSearchName: vi.fn(),
}));

import { auth } from "@/auth";
import { getOwnedBlockingSearchName } from "@/lib/poll-queue-context";
import { getPollQueueContext, queuePollSearch } from "@/lib/queue";
import { prisma } from "@price-monitor/database";
import { POST } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(prisma.savedSearch.findFirst);
const mockUpdate = vi.mocked(prisma.savedSearch.update);
const mockGetPollQueueContext = vi.mocked(getPollQueueContext);
const mockQueuePollSearch = vi.mocked(queuePollSearch);
const mockGetOwnedBlockingSearchName = vi.mocked(getOwnedBlockingSearchName);

function createRequestContext(searchId: string) {
  return {
    params: Promise.resolve({ id: searchId }),
  };
}

describe("POST /api/searches/[id]/poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "redis://localhost:6379";
    mockGetOwnedBlockingSearchName.mockResolvedValue({
      blockingSearchName: null,
      waitingForAnotherPoll: false,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when the search does not belong to the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Search not found");
  });

  it("returns 400 when the search is disabled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
      isEnabled: false,
      lastAttemptedAt: null,
    } as never);

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Search is disabled");
  });

  it("returns 429 with cooldown metadata when polled recently", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
      isEnabled: true,
      lastAttemptedAt: new Date(),
    } as never);
    mockGetPollQueueContext.mockResolvedValue({
      isQueued: false,
      jobState: null,
      waitingPosition: null,
      blockingSavedSearchId: undefined,
    });

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.errorCode).toBe("POLL_COOLDOWN");
    expect(body.remainingMinutes).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockQueuePollSearch).not.toHaveBeenCalled();
  });

  it("returns queued metadata when a poll is already active", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
      isEnabled: true,
      lastAttemptedAt: null,
    } as never);
    mockGetPollQueueContext.mockResolvedValue({
      isQueued: true,
      jobState: "active",
      waitingPosition: null,
      blockingSavedSearchId: "search-1",
    });
    mockGetOwnedBlockingSearchName.mockResolvedValue({
      blockingSearchName: "iPhone deals",
      waitingForAnotherPoll: false,
    });

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queued).toBe(false);
    expect(body.state).toBe("active");
    expect(body.blockingSearchName).toBe("iPhone deals");
    expect(mockQueuePollSearch).not.toHaveBeenCalled();
  });

  it("queues a poll and records lastAttemptedAt on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
      isEnabled: true,
      lastAttemptedAt: null,
    } as never);
    mockGetPollQueueContext
      .mockResolvedValueOnce({
        isQueued: false,
        jobState: null,
        waitingPosition: null,
        blockingSavedSearchId: undefined,
      })
      .mockResolvedValueOnce({
        isQueued: true,
        jobState: "waiting",
        waitingPosition: 1,
        blockingSavedSearchId: undefined,
      });
    mockQueuePollSearch.mockResolvedValue({
      queued: true,
      jobId: "poll-search-1",
      state: "waiting",
      queueContext: {
        isQueued: true,
        jobState: "waiting",
        waitingPosition: 1,
        blockingSavedSearchId: undefined,
      },
    });

    const response = await POST(new Request("http://localhost/api/searches/search-1/poll", { method: "POST" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queued).toBe(true);
    expect(body.jobId).toBe("poll-search-1");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: { lastAttemptedAt: expect.any(Date) },
    });
  });
});
