import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    savedSearch: {
      findFirst: vi.fn(),
    },
    pollSnapshotListing: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { GET } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindSearch = vi.mocked(prisma.savedSearch.findFirst);
const mockFindSnapshots = vi.mocked(prisma.pollSnapshotListing.findMany);

function request() {
  return new Request("http://localhost/api/searches/search-1/listings/listing-1/price-history");
}

function context(id = "search-1", listingId = "listing-1") {
  return { params: Promise.resolve({ id, listingId }) };
}

describe("GET /api/searches/[id]/listings/[listingId]/price-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect((await response.json()).errorCode).toBe("UNAUTHORIZED");
    expect(mockFindSnapshots).not.toHaveBeenCalled();
  });

  it("returns 404 when the search is missing or owned by someone else", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    mockFindSearch.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect((await response.json()).errorCode).toBe("SEARCH_NOT_FOUND");
    expect(mockFindSearch).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "search-1", userId: "user-2" } }),
    );
    expect(mockFindSnapshots).not.toHaveBeenCalled();
  });

  it("returns the priced series scoped to the search and the 30-day window", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindSearch.mockResolvedValue({ id: "search-1" } as never);
    mockFindSnapshots.mockResolvedValue([
      { priceCents: 200_000, pollRun: { startedAt: new Date("2026-10-30T10:00:00Z") } },
      { priceCents: null, pollRun: { startedAt: new Date("2026-10-31T10:00:00Z") } },
      { priceCents: 180_000, pollRun: { startedAt: new Date("2026-11-01T10:00:00Z") } },
    ] as never);

    const before = Date.now();
    const response = await GET(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.points).toEqual([
      { priceCents: 200_000, observedAt: "2026-10-30T10:00:00.000Z" },
      { priceCents: 180_000, observedAt: "2026-11-01T10:00:00.000Z" },
    ]);

    const query = mockFindSnapshots.mock.calls[0][0] as {
      where: { listingId: string; pollRun: { savedSearchId: string; startedAt: { gte: Date } } };
    };
    expect(query.where.listingId).toBe("listing-1");
    expect(query.where.pollRun.savedSearchId).toBe("search-1");
    const windowDays = (before - query.where.pollRun.startedAt.gte.getTime()) / 86_400_000;
    expect(windowDays).toBeCloseTo(30, 2);
  });

  it("returns an empty series when the listing was never observed by this search", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindSearch.mockResolvedValue({ id: "search-1" } as never);
    mockFindSnapshots.mockResolvedValue([]);

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ points: [] });
  });
});
