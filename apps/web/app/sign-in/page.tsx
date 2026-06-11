import Link from "next/link";
import { auth } from "@/auth";
import { SignInButtons } from "@/components/sign-in-buttons";
import { SignInErrorAlert } from "@/components/sign-in-error-alert";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "next/navigation";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/dashboard");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in with Google or GitHub to access your saved searches and alerts.
        </p>

        <SignInErrorAlert errorCode={error} />

        <SignInButtons callbackUrl={callbackUrl} />

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
