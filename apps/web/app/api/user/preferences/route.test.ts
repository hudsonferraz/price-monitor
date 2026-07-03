import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@price-monitor/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@price-monitor/database";
import { GET, PATCH } from "./route";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockUpdate = vi.mocked(prisma.user.update);

describe("/api/user/preferences", () => {
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

  it("GET returns user preferences", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      emailNotificationsEnabled: true,
      preferredLocale: "pt-BR",
    } as never);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preferredLocale).toBe("pt-BR");
  });

  it("PATCH rejects empty payloads", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(
      new Request("http://localhost/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe("NO_PREFERENCE_FIELDS");
  });

  it("PATCH rejects invalid locales", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await PATCH(
      new Request("http://localhost/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: "fr-FR" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errorCode).toBe("INVALID_PREFERRED_LOCALE");
  });

  it("PATCH updates notification preferences", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpdate.mockResolvedValue({
      emailNotificationsEnabled: false,
      preferredLocale: "en-US",
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotificationsEnabled: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.emailNotificationsEnabled).toBe(false);
  });
});
