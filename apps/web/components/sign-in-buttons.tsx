import { signIn } from "@/auth";

interface SignInButtonsProps {
  callbackUrl?: string;
}

export function SignInButtons({ callbackUrl }: SignInButtonsProps) {
  const redirectTo = callbackUrl ?? "/dashboard";

  return (
    <div className="mt-8 space-y-3">
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
          Continue with Google
        </button>
      </form>

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
          Continue with GitHub
        </button>
      </form>
    </div>
  );
}
