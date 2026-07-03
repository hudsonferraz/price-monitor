import { encodeEmailHref, escapeHtml, renderEmailLink } from "./email-html";
import type { AppLocale } from "./locales";
import { formatPriceCents } from "./poll-rate-limit";

export interface AlertEmailListing {
  title: string;
  url: string;
  priceCents: number | null;
  location: string | null;
  priceDroppedAt: Date | string | null;
  previousPriceCents: number | null;
}

export interface AlertEmailContentInput {
  locale: AppLocale;
  searchName: string;
  alerts: AlertEmailListing[];
  dashboardUrl: string;
}

export interface AlertEmailContent {
  subject: string;
  text: string;
  html: string;
}

const messages = {
  "en-US": {
    subjectSingleMatch: (searchName: string) => `New match for ${searchName}`,
    subjectMultipleMatches: (searchName: string, count: number) =>
      `${count} new matches for ${searchName}`,
    subjectSinglePriceDrop: (searchName: string) => `Price drop for ${searchName}`,
    subjectMixedPriceDrop: (searchName: string) => `Price drops and new matches for ${searchName}`,
    intro: (count: number, searchName: string) =>
      `You have ${count} new Facebook Marketplace match(es) for "${searchName}".`,
    htmlIntro: (count: number) =>
      `You have <strong>${count}</strong> new Facebook Marketplace match(es) for`,
    priceWas: (price: string) => `(was ${price})`,
    viewAllAlerts: "View all alerts",
    openDashboard: "Open your dashboard",
  },
  "pt-BR": {
    subjectSingleMatch: (searchName: string) => `Novo anuncio para ${searchName}`,
    subjectMultipleMatches: (searchName: string, count: number) =>
      `${count} novos anuncios para ${searchName}`,
    subjectSinglePriceDrop: (searchName: string) => `Queda de preco para ${searchName}`,
    subjectMixedPriceDrop: (searchName: string) =>
      `Quedas de preco e novos anuncios para ${searchName}`,
    intro: (count: number, searchName: string) =>
      `Voce tem ${count} novo(s) anuncio(s) no Facebook Marketplace para "${searchName}".`,
    htmlIntro: (count: number) =>
      `Voce tem <strong>${count}</strong> novo(s) anuncio(s) no Facebook Marketplace para`,
    priceWas: (price: string) => `(era ${price})`,
    viewAllAlerts: "Ver todos os alertas",
    openDashboard: "Abrir seu painel",
  },
} as const;

function buildSubject(
  locale: AppLocale,
  searchName: string,
  alertCount: number,
  hasPriceDrop: boolean,
): string {
  const copy = messages[locale];

  if (hasPriceDrop) {
    return alertCount === 1
      ? copy.subjectSinglePriceDrop(searchName)
      : copy.subjectMixedPriceDrop(searchName);
  }

  return alertCount === 1
    ? copy.subjectSingleMatch(searchName)
    : copy.subjectMultipleMatches(searchName, alertCount);
}

function buildPriceDropNote(
  locale: AppLocale,
  alert: AlertEmailListing,
  html: boolean,
): string {
  if (!alert.priceDroppedAt || alert.previousPriceCents == null) {
    return "";
  }

  const previousPrice = formatPriceCents(alert.previousPriceCents);
  const note = messages[locale].priceWas(previousPrice);
  return html ? ` <em>${escapeHtml(note)}</em>` : ` ${note}`;
}

export function buildAlertEmailContent(input: AlertEmailContentInput): AlertEmailContent {
  const { locale, searchName, alerts, dashboardUrl } = input;
  const copy = messages[locale];
  const alertCount = alerts.length;
  const hasPriceDrop = alerts.some((alert) => alert.priceDroppedAt != null);
  const subject = buildSubject(locale, searchName, alertCount, hasPriceDrop);
  const safeDashboardUrl = encodeEmailHref(dashboardUrl);
  const safeSearchName = escapeHtml(searchName);

  const listingLines = alerts
    .map((alert) => {
      const price = formatPriceCents(alert.priceCents);
      const location = alert.location ? ` · ${alert.location}` : "";
      const priceDropNote = buildPriceDropNote(locale, alert, false);
      return `• ${alert.title} — ${price}${priceDropNote}${location}\n  ${alert.url}`;
    })
    .join("\n\n");

  const text = [
    copy.intro(alertCount, searchName),
    "",
    listingLines,
    "",
    `${copy.viewAllAlerts}: ${safeDashboardUrl ?? dashboardUrl}`,
  ].join("\n");

  const html = `
    <p>${copy.htmlIntro(alertCount)} <strong>${safeSearchName}</strong>.</p>
    <ul>
      ${alerts
        .map((alert) => {
          const price = escapeHtml(formatPriceCents(alert.priceCents));
          const location = alert.location ? ` · ${escapeHtml(alert.location)}` : "";
          const priceDropNote = buildPriceDropNote(locale, alert, true);
          return `<li>${renderEmailLink(alert.url, alert.title)} — ${price}${priceDropNote}${location}</li>`;
        })
        .join("")}
    </ul>
    <p>${
      safeDashboardUrl
        ? `<a href="${escapeHtml(safeDashboardUrl)}">${escapeHtml(copy.openDashboard)}</a>`
        : escapeHtml(copy.openDashboard)
    }</p>
  `;

  return { subject, text, html };
}
