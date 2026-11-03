/**
 * Minimal Telegram Bot API client over fetch (no SDK). Only what the notifier and bot loop use.
 * The token is part of the request URL and is never included in errors or logs.
 */

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
    readonly retryAfterSeconds: number | null,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
    this.name = "TelegramApiError";
  }

  /** The user blocked the bot or deleted the chat: stop sending to it. */
  get isChatUnavailable(): boolean {
    return (
      this.status === 403 ||
      (this.status === 400 && /chat not found|user is deactivated/i.test(this.description))
    );
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Markup or URL problems that a plain-text retry can avoid. */
  get isFormattingProblem(): boolean {
    return this.status === 400 && /parse entities|wrong http url|url|wrong type of the web page content|failed to get http url content|wrong file identifier/i.test(this.description);
  }
}

export interface TelegramClientOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface TelegramClient {
  getMe(): Promise<TelegramUser>;
  getUpdates(offset: number | undefined, timeoutSeconds: number, signal?: AbortSignal): Promise<TelegramUpdate[]>;
  sendMessage(chatId: string, text: string, options?: { html?: boolean }): Promise<void>;
  sendPhoto(chatId: string, photoUrl: string, caption: string, options?: { html?: boolean }): Promise<void>;
}

export function createTelegramClient({
  token,
  baseUrl = "https://api.telegram.org",
  fetchImpl = fetch,
}: TelegramClientOptions): TelegramClient {
  const root = `${baseUrl.replace(/\/+$/, "")}/bot${token}`;

  async function call<T>(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = error instanceof Error ? error.message : "network error";
      throw new TelegramApiError(method, 0, `network error: ${reason}`, null);
    }

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: T;
      description?: string;
      parameters?: { retry_after?: number };
    } | null;

    if (!response.ok || !payload?.ok) {
      throw new TelegramApiError(
        method,
        response.status,
        payload?.description ?? response.statusText ?? "unknown error",
        payload?.parameters?.retry_after ?? null,
      );
    }
    return payload.result as T;
  }

  return {
    getMe: () => call<TelegramUser>("getMe", {}),
    getUpdates: (offset, timeoutSeconds, signal) =>
      call<TelegramUpdate[]>(
        "getUpdates",
        { offset, timeout: timeoutSeconds, allowed_updates: ["message"] },
        signal,
      ),
    sendMessage: async (chatId, text, options = {}) => {
      await call("sendMessage", {
        chat_id: chatId,
        text,
        ...(options.html ? { parse_mode: "HTML" } : {}),
        link_preview_options: { is_disabled: true },
      });
    },
    sendPhoto: async (chatId, photoUrl, caption, options = {}) => {
      await call("sendPhoto", {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        ...(options.html ? { parse_mode: "HTML" } : {}),
      });
    },
  };
}

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token ? token : null;
}

export function getTelegramApiBaseUrl(): string {
  return process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org";
}

export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim() || process.env.AUTH_URL?.trim() || "http://localhost:3000";
}

export function getTelegramSendIntervalMs(): number {
  const value = Number(process.env.TELEGRAM_SEND_INTERVAL_MS);
  return Number.isFinite(value) && value >= 0 ? value : 1100;
}
