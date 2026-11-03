import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatNotification,
  formatSummary,
  getDropEventKey,
  getDropPercent,
  isLinkCodeUsable,
  isPublicImageUrl,
  isWithinQuietHours,
  type NotificationEvent,
  type NotificationSettings,
  parseBotCommand,
  selectNotifications,
} from "./telegram-notifications";

const NOW = new Date("2026-11-03T15:00:00Z"); // 12:00 in São Paulo (UTC-3)

const settings: NotificationSettings = {
  connected: true,
  paused: false,
  searchEnabled: true,
  mode: "NEW_AND_DROPS",
  minDropPercent: 0,
  quietStartMinute: null,
  quietEndMinute: null,
  timeZone: "America/Sao_Paulo",
};

let counter = 0;
function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  counter += 1;
  return {
    alertId: `alert-${counter}`,
    kind: "new",
    eventKey: "new",
    title: `Listing ${counter}`,
    priceCents: 100_000,
    url: `https://www.facebook.com/marketplace/item/${counter}`,
    searchName: "iPhone 13",
    occurredAt: new Date(NOW.getTime() - counter * 1000),
    ...overrides,
  };
}

function drop(previousPriceCents: number, priceCents: number, overrides: Partial<NotificationEvent> = {}) {
  return event({ kind: "drop", eventKey: getDropEventKey(NOW), previousPriceCents, priceCents, ...overrides });
}

describe("getDropPercent", () => {
  it("returns the percentage for drops only", () => {
    expect(getDropPercent(200_000, 150_000)).toBe(25);
    expect(getDropPercent(100, 100)).toBeNull();
    expect(getDropPercent(100, 120)).toBeNull();
    expect(getDropPercent(null, 100)).toBeNull();
    expect(getDropPercent(0, 0)).toBeNull();
  });
});

describe("isWithinQuietHours", () => {
  const at = (iso: string) => new Date(iso);
  it("is off when unset or start equals end", () => {
    expect(isWithinQuietHours(NOW, null, null, "America/Sao_Paulo")).toBe(false);
    expect(isWithinQuietHours(NOW, 600, 600, "America/Sao_Paulo")).toBe(false);
  });

  it("handles same-day windows in the user's time zone", () => {
    // 12:00 local is inside 11:00-13:00 local, even though it is 15:00 UTC.
    expect(isWithinQuietHours(NOW, 11 * 60, 13 * 60, "America/Sao_Paulo")).toBe(true);
    expect(isWithinQuietHours(NOW, 11 * 60, 13 * 60, "UTC")).toBe(false);
  });

  it("handles windows that wrap past midnight", () => {
    const window = [23 * 60, 7 * 60] as const;
    expect(isWithinQuietHours(at("2026-11-04T02:30:00Z"), ...window, "America/Sao_Paulo")).toBe(true); // 23:30
    expect(isWithinQuietHours(at("2026-11-04T09:59:00Z"), ...window, "America/Sao_Paulo")).toBe(true); // 06:59
    expect(isWithinQuietHours(at("2026-11-04T10:00:00Z"), ...window, "America/Sao_Paulo")).toBe(false); // 07:00
    expect(isWithinQuietHours(at("2026-11-04T01:59:00Z"), ...window, "America/Sao_Paulo")).toBe(false); // 22:59
  });

  it("falls back to São Paulo for an invalid time zone", () => {
    expect(isWithinQuietHours(NOW, 11 * 60, 13 * 60, "Not/AZone")).toBe(true);
  });
});

describe("selectNotifications", () => {
  it("sends biggest drops first, then the newest matches, up to the limit", () => {
    const small = drop(100_000, 95_000);
    const big = drop(100_000, 60_000);
    const newer = event({ occurredAt: new Date(NOW.getTime() - 1) });
    const older = event({ occurredAt: new Date(NOW.getTime() - 60_000) });

    const result = selectNotifications([older, small, newer, big], settings, NOW, 3);

    expect(result.send).toEqual([big, small, newer]);
    expect(result.summarized).toEqual([older]);
    expect(result.skipped).toEqual([]);
  });

  it("summarizes everything past 5 events", () => {
    const events = Array.from({ length: 30 }, () => event());
    const result = selectNotifications(events, settings, NOW);
    expect(result.send).toHaveLength(5);
    expect(result.summarized).toHaveLength(25);
  });

  it.each([
    [{ connected: false }, "not_connected"],
    [{ paused: true }, "paused"],
    [{ searchEnabled: false }, "search_disabled"],
    [{ quietStartMinute: 11 * 60, quietEndMinute: 13 * 60 }, "quiet_hours"],
  ] as const)("skips every event when %j", (override, reason) => {
    const result = selectNotifications([event(), drop(100, 50)], { ...settings, ...override }, NOW);
    expect(result.send).toEqual([]);
    expect(result.skipped.map((entry) => entry.reason)).toEqual([reason, reason]);
  });

  it("skips new matches in drops-only mode", () => {
    const priceDrop = drop(100_000, 80_000);
    const result = selectNotifications([event(), priceDrop], { ...settings, mode: "DROPS_ONLY" }, NOW);
    expect(result.send).toEqual([priceDrop]);
    expect(result.skipped[0].reason).toBe("mode_drops_only");
  });

  it("skips drops below the minimum percentage", () => {
    const small = drop(100_000, 95_000); // 5%
    const big = drop(100_000, 85_000); // 15%
    const result = selectNotifications([small, big], { ...settings, minDropPercent: 10 }, NOW);
    expect(result.send).toEqual([big]);
    expect(result.skipped).toEqual([{ event: small, reason: "below_min_drop" }]);
  });
});

describe("formatNotification", () => {
  it("formats a drop with previous price and percentage, escaping HTML", () => {
    const message = formatNotification(
      drop(189_000, 154_000, {
        title: "iPhone 13 <128GB> & case",
        location: "Recife, PE",
        imageUrl: "https://scontent.xx.fbcdn.net/image.jpg",
      }),
      "pt-BR",
      "http://localhost:3000",
    );
    expect(message.text).toContain("📉 Preço caiu");
    expect(message.text).toContain("iPhone 13 &lt;128GB&gt; &amp; case");
    expect(message.plainText).toContain("iPhone 13 <128GB> & case");
    // Intl uses a non-breaking space after "R$"; normalize it for the comparison.
    expect(message.plainText.replace(/\s/g, " ")).toContain("R$ 1.540,00 (era R$ 1.890,00, −19%)");
    expect(message.text).toContain("📍 Recife, PE");
    expect(message.photoUrl).toBe("https://scontent.xx.fbcdn.net/image.jpg");
  });

  it("adds the market comparison when known", () => {
    const message = formatNotification(
      event({ priceCents: 154_000, belowMarketPercent: 22, marketPriceCents: 198_000 }),
      "en-US",
      "http://localhost:3000",
    );
    expect(message.plainText).toContain("📊 22% below market (R$1,980.00)");
    expect(formatNotification(event(), "en-US", "http://x").plainText).not.toContain("below market");
  });

  it("makes relative demo links absolute and skips non-public photos", () => {
    const message = formatNotification(
      event({ url: "/demo/listing/demo-1", imageUrl: "/demo/listing-1.svg" }),
      "en-US",
      "http://localhost:3000/",
    );
    expect(message.text).toContain("🆕 New deal");
    expect(message.text).toContain('href="http://localhost:3000/demo/listing/demo-1"');
    expect(message.photoUrl).toBeNull();
  });

  it("formats the summary with a dashboard link", () => {
    const summary = formatSummary(25, "iPhone <13>", "en-US", "http://localhost:3000");
    expect(summary.plainText).toBe('And 25 more deals in "iPhone <13>". See the dashboard: http://localhost:3000/dashboard');
    expect(summary.text).toContain("iPhone &lt;13&gt;");
  });
});

describe("helpers", () => {
  it("detects public image URLs", () => {
    expect(isPublicImageUrl("https://scontent.fbcdn.net/x.jpg")).toBe(true);
    expect(isPublicImageUrl("http://localhost:3000/x.svg")).toBe(false);
    expect(isPublicImageUrl("http://192.168.0.10/x.jpg")).toBe(false);
    expect(isPublicImageUrl("/demo/listing-1.svg")).toBe(false);
    expect(isPublicImageUrl(null)).toBe(false);
  });

  it("parses bot commands", () => {
    expect(parseBotCommand("/start abc_DEF-123")).toEqual({ command: "start", code: "abc_DEF-123" });
    expect(parseBotCommand("/start@PriceBot abc")).toEqual({ command: "start", code: "abc" });
    expect(parseBotCommand("/start")).toEqual({ command: "start", code: null });
    expect(parseBotCommand("/stop")).toEqual({ command: "stop" });
    expect(parseBotCommand("hello")).toEqual({ command: "unknown" });
  });

  it("checks link code usability", () => {
    expect(isLinkCodeUsable({ expiresAt: new Date(NOW.getTime() + 1), usedAt: null }, NOW)).toBe(true);
    expect(isLinkCodeUsable({ expiresAt: NOW, usedAt: null }, NOW)).toBe(false);
    expect(isLinkCodeUsable({ expiresAt: new Date(NOW.getTime() + 1), usedAt: NOW }, NOW)).toBe(false);
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});
