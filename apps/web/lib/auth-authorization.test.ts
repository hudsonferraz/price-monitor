import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isProtectedPath, protectedRouteMatchers } from "./auth-authorization";

const middlewarePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../middleware.ts");

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

  it("stays in sync with the middleware matcher literal", () => {
    // Next.js requires a static matcher literal in middleware.ts (no spreads/imports).
    // Parse that literal and assert it matches the canonical list.
    const middlewareSource = readFileSync(middlewarePath, "utf8");
    const matcherBlock = middlewareSource.match(/matcher:\s*\[([\s\S]*?)\]/);

    expect(matcherBlock).not.toBeNull();

    const middlewareMatchers = [...matcherBlock![1].matchAll(/"([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(middlewareMatchers).toEqual([...protectedRouteMatchers]);
  });
});
