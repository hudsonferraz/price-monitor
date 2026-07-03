import NextAuth from "next-auth";
import { protectedRouteMatchers } from "./lib/auth-authorization";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [...protectedRouteMatchers],
};
