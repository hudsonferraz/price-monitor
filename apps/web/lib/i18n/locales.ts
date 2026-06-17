export const APP_LOCALES = ["en-US", "pt-BR"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";

export const LOCALE_COOKIE_NAME = "price-monitor-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value != null && APP_LOCALES.includes(value as AppLocale);
}

export function getLocaleLabel(locale: AppLocale): string {
  return locale === "en-US" ? "English" : "Português";
}
