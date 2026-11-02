import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@price-monitor/database";
import { authConfig } from "./auth.config";
import { DEMO_USER_EMAIL, DEMO_USER_NAME, isDemoMode } from "./lib/demo-mode";

/**
 * One-click demo sign-in for local demo mode. Kept out of auth.config.ts because that
 * config also runs in edge middleware, where Prisma is not available.
 * `authorize` re-checks demo mode on every call, so the provider is inert otherwise.
 */
const demoProvider = Credentials({
  id: "demo",
  name: "Demo",
  credentials: {},
  async authorize() {
    if (!isDemoMode()) {
      return null;
    }

    const user = await prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      create: { email: DEMO_USER_EMAIL, name: DEMO_USER_NAME },
      update: {},
    });

    return { id: user.id, email: user.email, name: user.name };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [...authConfig.providers, demoProvider],
});
