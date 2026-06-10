import Link from "next/link";
import { auth, signIn } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "next/navigation";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/dashboard");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use GitHub to access your saved searches and alerts.
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: callbackUrl ?? "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Continue with GitHub
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
