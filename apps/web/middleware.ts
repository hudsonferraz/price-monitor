import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

// Keep in sync with protectedRouteMatchers in lib/auth-authorization.ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/searches/:path*",
    "/api/alerts/:path*",
    "/api/user/:path*",
  ],
};
