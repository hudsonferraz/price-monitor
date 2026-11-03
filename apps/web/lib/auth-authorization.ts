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
    pathname.startsWith("/api/user") ||
    pathname.startsWith("/api/telegram")
  );
}

export { protectedRouteMatchers } from "./protected-route-matchers";
