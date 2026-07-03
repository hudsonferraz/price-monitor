export function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/dashboard")) {
    return true;
  }

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/locale")) {
    return false;
  }

  return (
    pathname.startsWith("/api/searches") ||
    pathname.startsWith("/api/alerts") ||
    pathname.startsWith("/api/user")
  );
}

export const protectedRouteMatchers = [
  "/dashboard/:path*",
  "/api/searches/:path*",
  "/api/alerts/:path*",
  "/api/user/:path*",
] as const;
