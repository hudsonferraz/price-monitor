import type { AppLocale } from "./locales";
import type { MessageKey } from "./messages/en-US";

export type TranslationValues = Record<string, string | number>;

export type Messages = Record<MessageKey, string>;

export function createTranslator(messages: Messages) {
  return function translate(key: MessageKey, values?: TranslationValues): string {
    let text: string = messages[key] ?? String(key);

    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }

    return text;
  };
}

export type Translator = ReturnType<typeof createTranslator>;

const dictionaries: Record<AppLocale, () => Promise<Messages>> = {
  "en-US": async () => (await import("./messages/en-US")).messages as Messages,
  "pt-BR": async () => (await import("./messages/pt-BR")).messages as Messages,
};

export async function getMessages(locale: AppLocale): Promise<Messages> {
  return dictionaries[locale]();
}

export async function getTranslator(locale: AppLocale): Promise<Translator> {
  const messages = await getMessages(locale);
  return createTranslator(messages);
}

export function formatCountLabel(
  locale: AppLocale,
  count: number,
  labels: { one: string; other: string },
): string {
  if (locale === "pt-BR") {
    return count === 1 ? labels.one : labels.other;
  }

  return count === 1 ? labels.one : labels.other;
}

export function formatSearchSummary(
  locale: AppLocale,
  searchCount: number,
  listingCount: number,
): string {
  if (locale === "pt-BR") {
    const searches =
      searchCount === 1 ? `${searchCount} busca` : `${searchCount} buscas`;
    const listings =
      listingCount === 1 ? `${listingCount} anúncio` : `${listingCount} anúncios`;
    return `${searches} · ${listings} no total`;
  }

  const searches = searchCount === 1 ? `${searchCount} search` : `${searchCount} searches`;
  const listings = listingCount === 1 ? `${listingCount} listing` : `${listingCount} listings`;
  return `${searches} · ${listings} total`;
}

export function formatPriceCents(cents: number | null, locale: AppLocale): string {
  if (cents == null) {
    return locale === "pt-BR" ? "Preço indisponível" : "Price unavailable";
  }

  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function formatAnyPrice(locale: AppLocale): string {
  return locale === "pt-BR" ? "Qualquer" : "Any";
}

export function formatDateTime(value: string | Date, locale: AppLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(locale);
}

export function formatShortDate(value: string | Date, locale: AppLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
