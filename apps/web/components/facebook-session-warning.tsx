"use client";

import { useTranslations } from "@/components/locale-provider";

interface FacebookSessionWarningProps {
  show: boolean;
}

export function FacebookSessionWarning({ show }: FacebookSessionWarningProps) {
  const t = useTranslations();

  if (!show) {
    return null;
  }

  return (
    <section
      className="mb-10 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
      role="alert"
    >
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {t("facebookSessionTitle")}
      </h2>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
        {t("facebookSessionDescription")}
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-100/90">
        <li>{t("facebookSessionStep1")}</li>
        <li>{t("facebookSessionStep2")}</li>
        <li>{t("facebookSessionStep3")}</li>
        <li>{t("facebookSessionStep4")}</li>
      </ol>
      <p className="mt-3 text-sm">
        <a
          href="https://github.com/hudsonferraz/price-monitor/blob/main/docs/render-deploy.md#step-4--upload-facebook-session-secret-file"
          className="font-medium text-amber-900 underline dark:text-amber-200"
          target="_blank"
          rel="noreferrer"
        >
          {t("facebookSessionDocs")}
        </a>
      </p>
    </section>
  );
}
