import type { AppLocale } from "@price-monitor/shared/locales";

export {
  APP_LOCALES,
  DEFAULT_LOCALE,
  isAppLocale,
  normalizeAppLocale,
  type AppLocale,
} from "@price-monitor/shared/locales";

export const LOCALE_COOKIE_NAME = "price-monitor-locale";

export function getLocaleLabel(locale: AppLocale): string {
  return locale === "en-US" ? "English" : "Português";
}
