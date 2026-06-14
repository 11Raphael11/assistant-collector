import { describe, it, expect, vi } from "vitest";
import { notifyTelegram } from "./telegram";

type FetchCall = {
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

function makeFetch(
  response: { ok: boolean; status: number; body?: string } | Error,
) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: FetchCall["init"]) => {
    calls.push({ url, init });
    if (response instanceof Error) {
      throw response;
    }
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? "",
    };
  });
  return { fn, calls };
}

describe("notifyTelegram", () => {
  it("happy: posts to telegram bot api when configured", async () => {
    const { fn, calls } = makeFetch({ ok: true, status: 200 });

    const result = await notifyTelegram("critical: outbox failure", {
      fetchImpl: fn,
      botToken: "BOT123",
      chatId: "CHAT456",
    });

    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe(
      "https://api.telegram.org/botBOT123/sendMessage",
    );
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers?.["Content-Type"]).toBe("application/json");
    const body = JSON.parse(calls[0].init?.body ?? "{}") as {
      chat_id: string;
      text: string;
    };
    expect(body.chat_id).toBe("CHAT456");
    expect(body.text).toBe("critical: outbox failure");
  });

  it("edge: missing bot token → no network call, returns ok", async () => {
    const { fn } = makeFetch({ ok: true, status: 200 });

    const result = await notifyTelegram("x", {
      fetchImpl: fn,
      botToken: "",
      chatId: "CHAT456",
    });

    expect(result.ok).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  it("edge: missing chat id → no network call, returns ok", async () => {
    const { fn } = makeFetch({ ok: true, status: 200 });

    const result = await notifyTelegram("x", {
      fetchImpl: fn,
      botToken: "BOT123",
      chatId: "",
    });

    expect(result.ok).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  it("edge: fetch rejects (network failure) → returns err('TELEGRAM_FAILED'), does not throw", async () => {
    const { fn } = makeFetch(new Error("ECONNRESET"));

    const result = await notifyTelegram("boom", {
      fetchImpl: fn,
      botToken: "BOT123",
      chatId: "CHAT456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TELEGRAM_FAILED");
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("edge: non-2xx response → returns err('TELEGRAM_FAILED'), does not throw", async () => {
    const { fn } = makeFetch({ ok: false, status: 429, body: "rate limited" });

    const result = await notifyTelegram("boom", {
      fetchImpl: fn,
      botToken: "BOT123",
      chatId: "CHAT456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TELEGRAM_FAILED");
    }
  });

  it("happy: never throws even when fetchImpl throws synchronously", async () => {
    const badFetch = (() => {
      throw new Error("sync boom");
    }) as unknown as Parameters<typeof notifyTelegram>[1] extends infer _
      ? never
      : never;

    const result = await notifyTelegram("boom", {
      fetchImpl: (() => {
        throw new Error("sync boom");
      }) as never,
      botToken: "BOT123",
      chatId: "CHAT456",
    });
    void badFetch;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TELEGRAM_FAILED");
    }
  });
});
