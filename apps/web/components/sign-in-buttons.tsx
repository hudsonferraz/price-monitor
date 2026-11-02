import { signIn } from "@/auth";

interface SignInButtonsProps {
  callbackUrl?: string;
  googleLabel: string;
  githubLabel: string;
  demoLabel: string;
  demoNote: string;
  showGoogle: boolean;
  showGitHub: boolean;
  showDemo: boolean;
}

export function SignInButtons({
  callbackUrl,
  googleLabel,
  githubLabel,
  demoLabel,
  demoNote,
  showGoogle,
  showGitHub,
  showDemo,
}: SignInButtonsProps) {
  const redirectTo = callbackUrl ?? "/dashboard";

  return (
    <div className="mt-8 space-y-3">
      {showDemo ? (
        <form
          action={async () => {
            "use server";
            await signIn("demo", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-400"
          >
            {demoLabel}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">{demoNote}</p>
        </form>
      ) : null}

      {showGoogle ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--background)]"
          >
            {googleLabel}
          </button>
        </form>
      ) : null}

      {showGitHub ? (
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            {githubLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
