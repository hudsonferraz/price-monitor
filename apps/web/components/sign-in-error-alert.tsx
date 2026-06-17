"use client";

import { useTranslations } from "@/components/locale-provider";
import { getSignInErrorMessageKey } from "@/lib/sign-in-errors";

interface SignInErrorAlertProps {
  errorCode?: string;
}

export function SignInErrorAlert({ errorCode }: SignInErrorAlertProps) {
  const t = useTranslations();
  const messageKey = getSignInErrorMessageKey(errorCode);

  if (!messageKey) {
    return null;
  }

  return (
    <div
      role="alert"
      className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="font-medium">{t("signInFailedTitle")}</p>
      <p className="mt-1">{t(messageKey)}</p>
    </div>
  );
}
