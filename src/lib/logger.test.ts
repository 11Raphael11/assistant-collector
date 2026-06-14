import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import { createLogger, withContext, logger } from "./logger";

function captureLogs(): { stream: Writable; lines: () => unknown[] } {
  const buf: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf.push(chunk.toString());
      cb();
    },
  });
  return {
    stream,
    lines: () =>
      buf
        .join("")
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as unknown),
  };
}

describe("logger", () => {
  it("happy: withContext attaches context fields to each log entry", () => {
    const cap = captureLogs();
    const base = createLogger(cap.stream);
    const child = withContext({ businessId: "b1", action: "create" }, base);

    child.info("hello");

    const entries = cap.lines() as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0].businessId).toBe("b1");
    expect(entries[0].action).toBe("create");
    expect(entries[0].msg).toBe("hello");
  });

  it("happy: child loggers inherit context across nested withContext calls", () => {
    const cap = captureLogs();
    const base = createLogger(cap.stream);
    const a = withContext({ businessId: "b1" }, base);
    const b = withContext({ action: "x" }, a);

    b.info("nested");

    const entry = (cap.lines() as Array<Record<string, unknown>>)[0];
    expect(entry.businessId).toBe("b1");
    expect(entry.action).toBe("x");
  });

  it("edge: redacts PII (phone, nationalId) and secrets (password, token, apiKey)", () => {
    const cap = captureLogs();
    const base = createLogger(cap.stream);

    base.info(
      {
        phone: "09121234567",
        nationalId: "0012345678",
        password: "p@ss",
        token: "tok_abc",
        apiKey: "sk-123",
        phoneLast4: "4567",
        businessId: "b1",
      },
      "sensitive",
    );

    const entry = (cap.lines() as Array<Record<string, unknown>>)[0];
    expect(entry.phone).toBe("[REDACTED]");
    expect(entry.nationalId).toBe("[REDACTED]");
    expect(entry.password).toBe("[REDACTED]");
    expect(entry.token).toBe("[REDACTED]");
    expect(entry.apiKey).toBe("[REDACTED]");
    expect(entry.phoneLast4).toBe("4567");
    expect(entry.businessId).toBe("b1");
  });

  it("edge: redacts nested PII fields inside an object", () => {
    const cap = captureLogs();
    const base = createLogger(cap.stream);

    base.info(
      {
        user: { phone: "09121234567", nationalId: "0012345678" },
        action: "x",
      },
      "nested",
    );

    const entry = (cap.lines() as Array<Record<string, unknown>>)[0];
    const user = entry.user as Record<string, unknown>;
    expect(user.phone).toBe("[REDACTED]");
    expect(user.nationalId).toBe("[REDACTED]");
    expect(entry.action).toBe("x");
  });

  it("happy: exports a default singleton logger", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.child).toBe("function");
  });
});
