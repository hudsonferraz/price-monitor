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
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">
        {t("languageLabel")}
      </span>
      <div
        className="inline-flex rounded-md border border-[var(--border)] bg-[var(--background)] p-0.5"
        role="group"
        aria-label={t("languageLabel")}
      >
        {APP_LOCALES.map((option) => {
          const isActive = locale === option;

          return (
            <button
              key={option}
              type="button"
              disabled={isSaving}
              onClick={() => handleChange(option)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              aria-pressed={isActive}
            >
              {getLocaleLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
