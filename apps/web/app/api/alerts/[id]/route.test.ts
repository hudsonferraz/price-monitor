import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    alert: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { DELETE } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(prisma.alert.findFirst);
const mockUpdate = vi.mocked(prisma.alert.update);

function createRequestContext(alertId: string) {
  return {
    params: Promise.resolve({ id: alertId }),
  };
}

describe("DELETE /api/alerts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/alerts/alert-1", { method: "DELETE" }), createRequestContext("alert-1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the alert is not owned by the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const response = await DELETE(new Request("http://localhost/api/alerts/alert-1", { method: "DELETE" }), createRequestContext("alert-1"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.errorCode).toBe("ALERT_NOT_FOUND");
  });

  it("dismisses an owned alert", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({ id: "alert-1", userId: "user-1" } as never);

    const response = await DELETE(new Request("http://localhost/api/alerts/alert-1", { method: "DELETE" }), createRequestContext("alert-1"));

    expect(response.status).toBe(204);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "alert-1" },
      data: { dismissedAt: expect.any(Date) },
    });
  });
});
