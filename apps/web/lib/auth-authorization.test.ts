import { describe, expect, it } from "vitest";
import { isProtectedPath, protectedRouteMatchers } from "./auth-authorization";

describe("isProtectedPath", () => {
  it("protects dashboard routes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/settings")).toBe(true);
  });

  it("protects authenticated API routes", () => {
    expect(isProtectedPath("/api/searches")).toBe(true);
    expect(isProtectedPath("/api/searches/search-1/poll")).toBe(true);
    expect(isProtectedPath("/api/alerts")).toBe(true);
    expect(isProtectedPath("/api/alerts/alert-1")).toBe(true);
    expect(isProtectedPath("/api/user/preferences")).toBe(true);
  });

  it("leaves public auth and locale routes open", () => {
    expect(isProtectedPath("/api/auth/signin")).toBe(false);
    expect(isProtectedPath("/api/locale")).toBe(false);
  });

  it("leaves marketing routes open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
  });
});

describe("protectedRouteMatchers", () => {
  it("includes dashboard and authenticated API prefixes", () => {
    expect(protectedRouteMatchers).toEqual([
      "/dashboard/:path*",
      "/api/searches/:path*",
      "/api/alerts/:path*",
      "/api/user/:path*",
    ]);
  });
});
