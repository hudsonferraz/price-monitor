import { setLocaleAction } from "@/app/actions/locale";
import { getTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/get-locale";
import { APP_LOCALES, getLocaleLabel } from "@/lib/i18n/locales";

export async function LanguageSwitch() {
  const locale = await getLocale();
  const t = await getTranslator(locale);

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
            <form key={option} action={setLocaleAction}>
              <input type="hidden" name="locale" value={option} />
              <button
                type="submit"
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                aria-pressed={isActive}
              >
                {getLocaleLabel(option)}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
