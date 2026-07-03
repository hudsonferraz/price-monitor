import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    savedSearch: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { GET, PATCH, POST } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindMany = vi.mocked(prisma.savedSearch.findMany);
const mockFindFirst = vi.mocked(prisma.savedSearch.findFirst);
const mockCreate = vi.mocked(prisma.savedSearch.create);
const mockUpdate = vi.mocked(prisma.savedSearch.update);

const savedSearchRecord = {
  id: "search-1",
  name: "iPhone deals",
  keywords: "iphone 13",
  minPriceCents: 100000,
  maxPriceCents: 300000,
  pollIntervalMin: 30,
  listingLimit: 24,
  isEnabled: true,
  lastAttemptedAt: null,
  lastSuccessfulPollAt: null,
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
};

describe("/api/searches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe("UNAUTHORIZED");
  });

  it("GET returns the user's searches", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindMany.mockResolvedValue([savedSearchRecord] as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("search-1");
  });

  it("POST returns validation errors for invalid payloads", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(
      new Request("http://localhost/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", keywords: "" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_FAILED");
    expect(body.details).toBeDefined();
  });

  it("POST creates a saved search", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockCreate.mockResolvedValue(savedSearchRecord as never);

    const response = await POST(
      new Request("http://localhost/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "iPhone deals",
          keywords: "iphone 13",
          minPriceReais: 1000,
          maxPriceReais: 3000,
          pollIntervalMin: 30,
          listingLimit: 24,
          isEnabled: true,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("search-1");
  });

  it("PATCH returns 404 when the search is not owned by the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/searches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "search-1", name: "Updated" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe("SEARCH_NOT_FOUND");
  });

  it("PATCH updates an owned search", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(savedSearchRecord as never);
    mockUpdate.mockResolvedValue({ ...savedSearchRecord, name: "Updated deals" } as never);

    const response = await PATCH(
      new Request("http://localhost/api/searches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "search-1", name: "Updated deals" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Updated deals");
  });
});
