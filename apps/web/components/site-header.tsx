import Link from "next/link";
import { auth } from "@/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          price-monitor
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Dashboard
              </Link>
              <span className="hidden text-[var(--muted)] sm:inline">{session.user.email}</span>
              <Link
                href="/api/auth/signout"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--background)]"
              >
                Sign out
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-white hover:bg-[var(--accent-hover)]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
