/**
 * Canonical protected-route matcher list.
 * middleware.ts must keep an identical literal for Next.js static analysis
 * (Next 15 rejects spreads/imports in `config.matcher`).
 */
export const protectedRouteMatchers = [
  "/dashboard/:path*",
  "/api/searches/:path*",
  "/api/alerts/:path*",
  "/api/user/:path*",
] as const;
