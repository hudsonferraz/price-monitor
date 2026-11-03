import { describe, expect, it, vi } from "vitest";
import { createTelegramClient, TelegramApiError } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createTelegramClient", () => {
  it("posts JSON to the bot method URL and returns the result", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, result: { id: 1, username: "price_bot" } }));
    const client = createTelegramClient({ token: "123:secret", baseUrl: "http://fake/", fetchImpl });

    await expect(client.getMe()).resolves.toEqual({ id: 1, username: "price_bot" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://fake/bot123:secret/getMe");
    expect(init.method).toBe("POST");
  });

  it("sends HTML messages with previews disabled", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, result: {} }));
    const client = createTelegramClient({ token: "t", baseUrl: "http://fake", fetchImpl });

    await client.sendMessage("42", "<b>hi</b>", { html: true });
    await client.sendPhoto("42", "https://img/x.jpg", "caption");

    const bodies = fetchImpl.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0]).toMatchObject({ chat_id: "42", text: "<b>hi</b>", parse_mode: "HTML" });
    expect(bodies[1]).toEqual({ chat_id: "42", photo: "https://img/x.jpg", caption: "caption" });
  });

  it("maps API errors without leaking the token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(429, { ok: false, description: "Too Many Requests: retry after 3", parameters: { retry_after: 3 } }),
    );
    const client = createTelegramClient({ token: "123:secret", baseUrl: "http://fake", fetchImpl });

    const error = (await client.sendMessage("1", "x").catch((caught) => caught)) as TelegramApiError;
    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.isRateLimited).toBe(true);
    expect(error.retryAfterSeconds).toBe(3);
    expect(error.message).not.toContain("secret");
  });

  it("classifies blocked chats and formatting problems", () => {
    expect(new TelegramApiError("sendMessage", 403, "Forbidden: bot was blocked by the user", null).isChatUnavailable).toBe(true);
    expect(new TelegramApiError("sendMessage", 400, "Bad Request: chat not found", null).isChatUnavailable).toBe(true);
    expect(new TelegramApiError("sendMessage", 400, "Bad Request: can't parse entities", null).isFormattingProblem).toBe(true);
    expect(new TelegramApiError("sendPhoto", 400, "Bad Request: wrong HTTP URL specified", null).isFormattingProblem).toBe(true);
  });

  it("wraps network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createTelegramClient({ token: "t", baseUrl: "http://fake", fetchImpl });
    const error = (await client.getMe().catch((caught) => caught)) as TelegramApiError;
    expect(error.status).toBe(0);
    expect(error.description).toContain("fetch failed");
  });
});
