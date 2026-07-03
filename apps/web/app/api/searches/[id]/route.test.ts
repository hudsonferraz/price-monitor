import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    savedSearch: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@price-monitor/queue", () => ({
  cancelPollSearchJob: vi.fn(),
}));

import { auth } from "@/auth";
import { cancelPollSearchJob } from "@price-monitor/queue";
import { prisma } from "@price-monitor/database";
import { DELETE } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(prisma.savedSearch.findFirst);
const mockUpdate = vi.mocked(prisma.savedSearch.update);
const mockDelete = vi.mocked(prisma.savedSearch.delete);
const mockCancelPollSearchJob = vi.mocked(cancelPollSearchJob);

function createRequestContext(searchId: string) {
  return {
    params: Promise.resolve({ id: searchId }),
  };
}

describe("DELETE /api/searches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/searches/search-1", { method: "DELETE" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when the search does not belong to the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/searches/search-1", { method: "DELETE" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Search not found");
  });

  it("returns 409 when an active poll cannot be cancelled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
    } as never);
    mockCancelPollSearchJob.mockResolvedValue({
      removed: false,
      reason: "active",
    });

    const response = await DELETE(new Request("http://localhost/api/searches/search-1", { method: "DELETE" }), createRequestContext("search-1"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("poll is currently running");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: { isEnabled: false },
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes the search when no active poll is blocking removal", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "search-1",
      userId: "user-1",
    } as never);
    mockCancelPollSearchJob.mockResolvedValue({
      removed: true,
      reason: "removed",
    });

    const response = await DELETE(new Request("http://localhost/api/searches/search-1", { method: "DELETE" }), createRequestContext("search-1"));

    expect(response.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "search-1" } });
  });
});
