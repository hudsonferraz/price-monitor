"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_LOCALES, getLocaleLabel, type AppLocale } from "@/lib/i18n/locales";
import { useLocale, useTranslations } from "@/components/locale-provider";

export function LanguageSwitch() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(nextLocale: AppLocale) {
    if (nextLocale === locale || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
      <span className="sr-only">{t("languageLabel")}</span>
      <select
        value={locale}
        disabled={isSaving}
        onChange={(event) => handleChange(event.target.value as AppLocale)}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
        aria-label={t("languageLabel")}
      >
        {APP_LOCALES.map((option) => (
          <option key={option} value={option}>
            {getLocaleLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
