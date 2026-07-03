export const APP_LOCALES = ["en-US", "pt-BR"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pt-BR";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value != null && (APP_LOCALES as readonly string[]).includes(value);
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}
