import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

// Keep identical to protectedRouteMatchers in lib/protected-route-matchers.ts.
// Next.js requires a static literal here (no imports or spreads).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/searches/:path*",
    "/api/alerts/:path*",
    "/api/user/:path*",
  ],
};
