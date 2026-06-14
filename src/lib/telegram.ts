import { env } from "./env";
import { logger } from "./logger";
import { ok, err, type Result } from "./result";

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export type NotifyTelegramDeps = {
  fetchImpl?: FetchLike;
  botToken?: string;
  chatId?: string;
};

export async function notifyTelegram(
  message: string,
  deps: NotifyTelegramDeps = {},
): Promise<Result<void>> {
  const botToken = deps.botToken ?? env.TELEGRAM_BOT_TOKEN;
  const chatId = deps.chatId ?? env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    logger.warn(
      { action: "notifyTelegram" },
      "telegram not configured; skipping alert",
    );
    return ok(undefined);
  }

  const fetchImpl: FetchLike =
    deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!response.ok) {
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "";
      }
      logger.error(
        { action: "notifyTelegram", status: response.status, body },
        "telegram api returned non-2xx",
      );
      return err(
        "TELEGRAM_FAILED",
        `telegram api responded with status ${response.status}`,
      );
    }

    return ok(undefined);
  } catch (cause) {
    logger.error(
      { action: "notifyTelegram", err: String(cause) },
      "telegram request failed",
    );
    return err("TELEGRAM_FAILED", "telegram request failed", cause);
  }
}
