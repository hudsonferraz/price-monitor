import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

export const authConfig = {
  trustHost: true,
  providers: [GitHub],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (isDashboard) {
        return Boolean(auth?.user);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
