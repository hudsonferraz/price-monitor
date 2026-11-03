import http from "node:http";
import type { AddressInfo } from "node:net";

export const FAKE_BOT_USERNAME = "price_monitor_test_bot";

export interface RecordedCall {
  method: string;
  body: Record<string, unknown>;
}

interface Failure {
  status: number;
  description: string;
  retryAfter?: number;
}

/**
 * Minimal stand-in for the Telegram Bot API: records sends, serves queued updates to getUpdates
 * (long-poll style), and can simulate failures, so tests never contact Telegram.
 */
export class FakeTelegram {
  readonly calls: RecordedCall[] = [];
  private readonly updates: Array<{ update_id: number; message: unknown }> = [];
  private nextUpdateId = 1;
  private readonly failures: Failure[] = [];
  private down = false;
  private server = http.createServer((request, response) => void this.handle(request, response));
  baseUrl = "";

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    const { port } = this.server.address() as AddressInfo;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  /** Simulates a user sending a private message to the bot. */
  pushMessage(chatId: number, text: string, languageCode = "pt-BR"): void {
    this.updates.push({
      update_id: this.nextUpdateId++,
      message: {
        message_id: this.nextUpdateId,
        chat: { id: chatId, type: "private" },
        from: { id: chatId, language_code: languageCode },
        text,
      },
    });
  }

  /** The next send (sendMessage/sendPhoto) fails with this response. */
  failNextSend(failure: Failure): void {
    this.failures.push(failure);
  }

  setDown(down: boolean): void {
    this.down = down;
  }

  sends(chatId?: string): RecordedCall[] {
    return this.calls.filter(
      (call) =>
        (call.method === "sendMessage" || call.method === "sendPhoto") &&
        (chatId === undefined || String(call.body.chat_id) === chatId),
    );
  }

  clear(): void {
    this.calls.length = 0;
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const body = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>) : {};
    const method = (request.url ?? "").split("/").pop() ?? "";

    const send = (status: number, payload: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };

    if (this.down && method !== "getUpdates" && method !== "getMe") {
      send(502, { ok: false, description: "Bad Gateway" });
      return;
    }

    if (method === "getMe") {
      send(200, { ok: true, result: { id: 1, is_bot: true, username: FAKE_BOT_USERNAME } });
      return;
    }

    if (method === "getUpdates") {
      const offset = typeof body.offset === "number" ? body.offset : 0;
      const deadline = Date.now() + Math.min(Number(body.timeout ?? 0), 2) * 1000;
      let pending = this.updates.filter((update) => update.update_id >= offset);
      while (pending.length === 0 && Date.now() < deadline && this.server.listening) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        pending = this.updates.filter((update) => update.update_id >= offset);
      }
      send(200, { ok: true, result: pending });
      return;
    }

    this.calls.push({ method, body });
    if (method === "sendMessage" || method === "sendPhoto") {
      const failure = this.failures.shift();
      if (failure) {
        send(failure.status, {
          ok: false,
          description: failure.description,
          ...(failure.retryAfter ? { parameters: { retry_after: failure.retryAfter } } : {}),
        });
        return;
      }
    }
    send(200, { ok: true, result: {} });
  }
}
