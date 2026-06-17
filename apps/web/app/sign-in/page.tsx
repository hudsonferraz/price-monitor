import Link from "next/link";
import { auth } from "@/auth";
import { SignInButtons } from "@/components/sign-in-buttons";
import { SignInErrorAlert } from "@/components/sign-in-error-alert";
import { SiteHeader } from "@/components/site-header";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";
import { redirect } from "next/navigation";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslator(locale);

  if (session?.user) {
    redirect(callbackUrl ?? "/dashboard");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-bold">{t("signInTitle")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("signInDescription")}</p>

        <SignInErrorAlert errorCode={error} />

        <SignInButtons
          callbackUrl={callbackUrl}
          googleLabel={t("signInGoogle")}
          githubLabel={t("signInGitHub")}
        />

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--foreground)]">
            {t("signInBackHome")}
          </Link>
        </p>
      </main>
    </div>
  );
}
