import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { GET } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.alert.findMany);

describe("GET /api/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/alerts"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe("UNAUTHORIZED");
  });

  it("returns alerts for the authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([
      {
        id: "alert-1",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        savedSearch: { id: "search-1", name: "iPhone deals" },
        listing: {
          id: "listing-1",
          source: "facebook",
          externalId: "123",
          title: "iPhone 13",
          priceCents: 250000,
          currency: "BRL",
          url: "https://facebook.com/marketplace/item/1",
          imageUrl: null,
          location: "Sao Paulo",
        },
      },
    ] as never);

    const response = await GET(new Request("http://localhost/api/alerts?savedSearchId=search-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].listing.title).toBe("iPhone 13");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          savedSearchId: "search-1",
        }),
      }),
    );
  });
});
