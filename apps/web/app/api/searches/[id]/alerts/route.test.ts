import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    savedSearch: {
      findFirst: vi.fn(),
    },
    alert: {
      updateMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { DELETE } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(prisma.savedSearch.findFirst);
const mockUpdateMany = vi.mocked(prisma.alert.updateMany);

function createRequestContext(searchId: string) {
  return {
    params: Promise.resolve({ id: searchId }),
  };
}

describe("DELETE /api/searches/[id]/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the search is not owned by the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/searches/search-1/alerts", { method: "DELETE" }),
      createRequestContext("search-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe("SEARCH_NOT_FOUND");
  });

  it("dismisses all alerts for an owned search", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({ id: "search-1", userId: "user-1" } as never);
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const response = await DELETE(
      new Request("http://localhost/api/searches/search-1/alerts", { method: "DELETE" }),
      createRequestContext("search-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dismissed).toBe(3);
  });
});
