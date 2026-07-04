import { describe, expect, it } from "vitest";
import { buildAlertEmailContent } from "./alert-email";

const alerts = [
  {
    title: "iPhone 13 128GB",
    url: "https://facebook.com/marketplace/item/1",
    priceCents: 250000,
    location: "Sao Paulo, SP",
    priceDroppedAt: null,
    previousPriceCents: null,
  },
  {
    title: "iPhone 13 Pro",
    url: "https://facebook.com/marketplace/item/2",
    priceCents: 320000,
    location: null,
    priceDroppedAt: new Date("2026-06-01T12:00:00.000Z"),
    previousPriceCents: 350000,
  },
];

describe("buildAlertEmailContent", () => {
  it("builds English content for a single match", () => {
    const content = buildAlertEmailContent({
      locale: "en-US",
      searchName: "iPhone deals",
      alerts: [alerts[0]],
      dashboardUrl: "http://localhost:3000/dashboard",
    });

    expect(content.subject).toBe("New match for iPhone deals");
    expect(content.text).toContain('new Facebook Marketplace match(es) for "iPhone deals"');
    expect(content.text).toContain("View all alerts: http://localhost:3000/dashboard");
    expect(content.html).toContain("Open your dashboard");
    expect(content.html).toContain("iPhone 13 128GB");
  });

  it("builds Portuguese content with price-drop subject", () => {
    const content = buildAlertEmailContent({
      locale: "pt-BR",
      searchName: "iPhone deals",
      alerts,
      dashboardUrl: "http://localhost:3000/dashboard",
    });

    expect(content.subject).toBe("Quedas de preco e novos anuncios para iPhone deals");
    expect(content.text).toContain('Voce tem 2 novo(s) anuncio(s) no Facebook Marketplace');
    expect(content.text).toContain("(era R$");
    expect(content.html).toContain("Abrir seu painel");
  });

  it("includes deal-quality notes in email content", () => {
    const content = buildAlertEmailContent({
      locale: "en-US",
      searchName: "iPhone deals",
      alerts: [
        {
          ...alerts[0],
          dealQuality: {
            isLowestSeen: true,
            isBelowRecentAverage: true,
            recentAverageCents: 480000,
          },
        },
      ],
      dashboardUrl: "http://localhost:3000/dashboard",
    });

    expect(content.text).toContain("Lowest seen");
    expect(content.text).toContain("Below recent average (R$");
    expect(content.html).toContain("Lowest seen");
  });
});
