import type { Worker } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { POST as pollSearch } from "@/app/api/searches/[id]/poll/route";
import { POST as createSearch } from "@/app/api/searches/route";
import { POST as createLink } from "@/app/api/telegram/link/route";
import { DELETE as disconnect, GET as getTelegram, PATCH as updateTelegram } from "@/app/api/telegram/route";
import { POST as requestTest } from "@/app/api/telegram/test/route";
import { startTelegramBot, type TelegramBotHandle } from "../../apps/worker/src/lib/telegram/bot";
import { notifyPollEvents } from "../../apps/worker/src/lib/telegram/notify";
import { MarketplaceSource, NotificationStatus, PollRunStatus, prisma } from "@price-monitor/database";
import { computeMarketSnapshot, getBelowMarketPercent } from "@price-monitor/shared/market-price";
import { FAKE_BOT_USERNAME, FakeTelegram } from "./fake-telegram";
import {
  allowAnotherPoll,
  closeQueueResources,
  createTestUser,
  expectedCatalog,
  jsonRequest,
  markWorkerOnline,
  routeContext,
  signInAs,
  startPollWorker,
  waitFor,
  waitForPollToFinish,
} from "./helpers";

const telegram = new FakeTelegram();
let worker: Worker;
let bot: TelegramBotHandle | null;
let nextChatId = 7_000;

beforeAll(async () => {
  await telegram.start();
  process.env.TELEGRAM_BOT_TOKEN = "123456:integration-test-token";
  process.env.TELEGRAM_API_BASE_URL = telegram.baseUrl;
  process.env.TELEGRAM_SEND_INTERVAL_MS = "0";
  process.env.APP_BASE_URL = "http://localhost:3000";
  bot = await startTelegramBot({ pollTimeoutSeconds: 1, errorBackoffMs: 100 });
  worker = startPollWorker();
});

afterAll(async () => {
  await bot?.stop();
  await closeQueueResources(worker);
  await telegram.stop();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_API_BASE_URL;
});

beforeEach(async () => {
  telegram.setDown(false);
  process.env.MOCK_MARKETPLACE_FAILURE_RATE = "0";
  await markWorkerOnline();
});

/** Links a fresh user's Telegram the way a person would: dashboard link, then /start in the bot. */
async function createConnectedUser(label: string) {
  const user = await createTestUser(label);
  const chatId = String(nextChatId++);
  signInAs(user);
  const response = await createLink();
  expect(response.status).toBe(200);
  const { deepLink } = (await response.json()) as { deepLink: string };
  expect(deepLink).toMatch(new RegExp(`^https://t\\.me/${FAKE_BOT_USERNAME}\\?start=[A-Za-z0-9_-]{32}$`));

  telegram.pushMessage(Number(chatId), `/start ${new URL(deepLink).searchParams.get("start")}`);
  await waitFor(`chat ${chatId} to be linked`, async () => {
    const connection = await prisma.telegramConnection.findUnique({ where: { userId: user.id } });
    return connection?.chatId === chatId;
  });
  return { user, chatId };
}

async function createSearchFor(user: { id: string }, keywords: string, extra: Record<string, unknown> = {}) {
  signInAs(user);
  const response = await createSearch(
    jsonRequest("/api/searches", "POST", { name: keywords, keywords, listingLimit: 24, ...extra }),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

async function pollAndWait(searchId: string, previousRuns: number) {
  if (previousRuns > 0) await allowAnotherPoll(searchId);
  const response = await pollSearch(jsonRequest(`/api/searches/${searchId}/poll`, "POST"), routeContext({ id: searchId }));
  expect(response.status).toBe(200);
  return waitForPollToFinish(searchId, previousRuns);
}

function notificationRows(searchId: string) {
  return prisma.alertNotification.findMany({ where: { alert: { savedSearchId: searchId } } });
}

describe("Telegram notifications (fake Telegram API, real worker, queue and database)", () => {
  it("links a chat from the dashboard link and confirms in Telegram", async () => {
    const { user, chatId } = await createConnectedUser("link");

    const confirmation = telegram.sends(chatId).at(-1);
    expect(confirmation?.body.text).toContain("Telegram conectado");

    signInAs(user);
    const status = await (await getTelegram()).json();
    expect(status.bot).toEqual({ running: true, username: FAKE_BOT_USERNAME });
    expect(status.connection).toMatchObject({ connected: true, paused: false, mode: "NEW_AND_DROPS" });
  });

  it("rejects a reused link code", async () => {
    const user = await createTestUser("reuse");
    signInAs(user);
    const { deepLink } = await (await createLink()).json();
    const code = new URL(deepLink).searchParams.get("start");
    telegram.pushMessage(9_101, `/start ${code}`);
    await waitFor("first link", async () => (await prisma.telegramConnection.findUnique({ where: { userId: user.id } }))?.chatId === "9101");

    telegram.pushMessage(9_102, `/start ${code}`);
    await waitFor("expired reply", async () => telegram.sends("9102").length > 0);
    expect(telegram.sends("9102")[0].body.text).toContain("expirou");
    expect((await prisma.telegramConnection.findUnique({ where: { userId: user.id } }))?.chatId).toBe("9101");
  });

  it("sends nothing for the baseline poll, then one message per new match and price drop", async () => {
    const { user, chatId } = await createConnectedUser("deals");
    const search = await createSearchFor(user, "iphone 13", { maxPriceReais: 3_500 });
    const searchRecord = await prisma.savedSearch.findUniqueOrThrow({ where: { id: search.id } });

    await pollAndWait(search.id, 0);
    const afterBaseline = telegram.sends(chatId).length;
    expect(await notificationRows(search.id)).toEqual([]);

    const run = await pollAndWait(search.id, 1);
    expect(run.status).toBe(PollRunStatus.SUCCESS);
    const rows = await notificationRows(search.id);
    const sent = rows.filter((row) => row.status === NotificationStatus.SENT);
    const summarized = rows.filter((row) => row.status === NotificationStatus.SUMMARIZED);
    expect(rows).toHaveLength(run.newAlerts);
    expect(sent.length).toBe(Math.min(run.newAlerts, 5));

    const messages = telegram.sends(chatId).slice(afterBaseline);
    expect(messages).toHaveLength(sent.length + (summarized.length > 0 ? 1 : 0));
    const texts = messages.map((message) => String(message.body.text));
    // Each sent event produced a message of its kind (the mix of drops and new matches varies by seed).
    const sentDrops = sent.filter((row) => row.eventKey.startsWith("drop:")).length;
    expect(sent.length).toBeGreaterThan(0);
    expect(texts.filter((text) => text.includes("📉 Preço caiu") && text.includes("era"))).toHaveLength(sentDrops);
    expect(texts.filter((text) => text.includes("🆕 Nova oferta"))).toHaveLength(sent.length - sentDrops);

    // "Below market" lines match the market of this poll recomputed from the marketplace results.
    const catalog = expectedCatalog(searchRecord, 1);
    const market = computeMarketSnapshot(catalog.map((listing) => listing.priceCents));
    const sentListings = await prisma.alert.findMany({
      where: { id: { in: sent.map((row) => row.alertId) } },
      include: { listing: true },
    });
    const expectedMarketLines = sentListings.filter((alert) => getBelowMarketPercent(alert.listing.priceCents, market) != null);
    expect(texts.filter((text) => text.includes("abaixo do mercado"))).toHaveLength(expectedMarketLines.length);
    for (const alert of expectedMarketLines) {
      const percent = getBelowMarketPercent(alert.listing.priceCents, market);
      expect(texts.some((text) => text.includes(alert.listing.title) && text.includes(`📊 ${percent}% abaixo do mercado`))).toBe(true);
    }
    expect(texts.every((text) => text.includes("http://localhost:3000/demo/listing/") || text.includes("/dashboard"))).toBe(true);
    // Demo images are local SVGs, which Telegram cannot fetch: plain messages, no photos.
    expect(messages.every((message) => message.method === "sendMessage")).toBe(true);

    // Polling again never repeats an event.
    await pollAndWait(search.id, 2);
    const allRows = await notificationRows(search.id);
    const keys = allRows.map((row) => `${row.alertId}|${row.eventKey}`);
    expect(new Set(keys).size).toBe(keys.length);
    const sentTotal = allRows.filter((row) => row.status === NotificationStatus.SENT).length;
    const summaryMessages = telegram.sends(chatId).slice(afterBaseline).filter((m) => String(m.body.text).includes("/dashboard")).length;
    expect(telegram.sends(chatId).length - afterBaseline).toBe(sentTotal + summaryMessages);
  });

  it("caps a large poll at 5 messages plus one summary, and never resends", async () => {
    const { user, chatId } = await createConnectedUser("flood");
    const search = await createSearchFor(user, "bicicleta");
    const alertIds: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      const listing = await prisma.listing.create({
        data: {
          source: MarketplaceSource.FACEBOOK,
          externalId: `flood-${search.id}-${index}`,
          title: `Bicicleta ${index}`,
          priceCents: 100_000 + index,
          url: `https://www.facebook.com/marketplace/item/${index}`,
          imageUrl: "https://scontent.example-cdn.net/bike.jpg",
        },
      });
      const alert = await prisma.alert.create({
        data: { userId: user.id, savedSearchId: search.id, listingId: listing.id },
      });
      alertIds.push(alert.id);
    }
    const before = telegram.sends(chatId).length;

    const result = await notifyPollEvents({ savedSearchId: search.id, newAlertIds: alertIds, dropAlertIds: [] });
    const again = await notifyPollEvents({ savedSearchId: search.id, newAlertIds: alertIds, dropAlertIds: [] });

    expect(result).toMatchObject({ sent: 5, summarized: 25, failed: 0 });
    expect(again).toMatchObject({ sent: 0, summarized: 0 });
    const messages = telegram.sends(chatId).slice(before);
    expect(messages).toHaveLength(6);
    expect(messages.slice(0, 5).every((message) => message.method === "sendPhoto")).toBe(true);
    expect(String(messages[5].body.text)).toContain("E mais 25 ofertas");
  });

  it("applies drops-only mode, quiet hours and the per-search switch", async () => {
    const { user, chatId } = await createConnectedUser("settings");
    signInAs(user);
    expect((await updateTelegram(jsonRequest("/api/telegram", "PATCH", { mode: "DROPS_ONLY" }))).status).toBe(200);

    const search = await createSearchFor(user, "geladeira");
    await pollAndWait(search.id, 0);
    await pollAndWait(search.id, 1);
    const rows = await notificationRows(search.id);
    expect(rows.filter((row) => row.reason === "mode_drops_only").length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.status === NotificationStatus.SENT).every((row) => row.eventKey.startsWith("drop:"))).toBe(true);

    // Quiet all day (00:00-23:59) in São Paulo: everything is skipped and never sent later.
    await updateTelegram(jsonRequest("/api/telegram", "PATCH", { quietStartMinute: 0, quietEndMinute: 1439 }));
    const beforeQuiet = telegram.sends(chatId).length;
    await pollAndWait(search.id, 2);
    expect(telegram.sends(chatId).length).toBe(beforeQuiet);
    expect((await notificationRows(search.id)).some((row) => row.reason === "quiet_hours")).toBe(true);

    await updateTelegram(jsonRequest("/api/telegram", "PATCH", { quietStartMinute: null, quietEndMinute: null, mode: "NEW_AND_DROPS" }));
    const muted = await createSearchFor(user, "sofa", { notificationsEnabled: false });
    await pollAndWait(muted.id, 0);
    const beforeMuted = telegram.sends(chatId).length;
    await pollAndWait(muted.id, 1);
    expect(telegram.sends(chatId).length).toBe(beforeMuted);
    const mutedRows = await notificationRows(muted.id);
    expect(mutedRows.length).toBeGreaterThan(0);
    expect(mutedRows.every((row) => row.reason === "search_disabled")).toBe(true);
  });

  it("keeps polls successful when Telegram is down, and records the failure", async () => {
    const { user } = await createConnectedUser("down");
    const search = await createSearchFor(user, "notebook");
    await pollAndWait(search.id, 0);

    telegram.setDown(true);
    const run = await pollAndWait(search.id, 1);

    expect(run.status).toBe(PollRunStatus.SUCCESS);
    const rows = await notificationRows(search.id);
    expect(rows.some((row) => row.status === NotificationStatus.FAILED)).toBe(true);
    const connection = await prisma.telegramConnection.findUniqueOrThrow({ where: { userId: user.id } });
    expect(connection.lastErrorMessage).toContain("502");
    expect(connection.chatId).not.toBeNull();
  });

  it("disconnects users who blocked the bot, and on /stop", async () => {
    const blocked = await createConnectedUser("blocked");
    const search = await createSearchFor(blocked.user, "camera");
    await pollAndWait(search.id, 0);
    telegram.failNextSend({ status: 403, description: "Forbidden: bot was blocked by the user" });
    const run = await pollAndWait(search.id, 1);
    expect(run.status).toBe(PollRunStatus.SUCCESS);
    expect((await prisma.telegramConnection.findUniqueOrThrow({ where: { userId: blocked.user.id } })).chatId).toBeNull();

    const stopper = await createConnectedUser("stopper");
    telegram.pushMessage(Number(stopper.chatId), "/stop");
    await waitFor("/stop to unlink", async () =>
      (await prisma.telegramConnection.findUniqueOrThrow({ where: { userId: stopper.user.id } })).chatId === null,
    );
    expect(String(telegram.sends(stopper.chatId).at(-1)?.body.text)).toContain("Notificações desativadas");
  });

  it("sends a test message requested from the dashboard and supports disconnect", async () => {
    const { user, chatId } = await createConnectedUser("test-message");
    signInAs(user);

    expect((await requestTest()).status).toBe(202);
    await waitFor("the worker to send the test message", async () =>
      telegram.sends(chatId).some((message) => String(message.body.text).includes("Mensagem de teste")),
    );
    await waitFor("the test request to clear", async () =>
      (await prisma.telegramConnection.findUniqueOrThrow({ where: { userId: user.id } })).testRequestedAt === null,
    );

    expect((await disconnect()).status).toBe(204);
    expect((await (await getTelegram()).json()).connection.connected).toBe(false);
    expect((await requestTest()).status).toBe(404);
  });

  it("reports the bot as not configured when the worker stops refreshing it", async () => {
    const user = await createTestUser("stale-bot");
    signInAs(user);
    await bot?.stop();
    bot = null;
    await prisma.telegramBotState.update({
      where: { id: "default" },
      data: { lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    expect((await (await getTelegram()).json()).bot.running).toBe(false);
    const response = await createLink();
    expect(response.status).toBe(503);
    expect((await response.json()).errorCode).toBe("TELEGRAM_NOT_CONFIGURED");
  });
});
