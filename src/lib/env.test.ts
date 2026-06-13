import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

function validEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    SESSION_SECRET: "super-secret",
    ENCRYPTION_KEY: "aa".repeat(32),
    BLIND_INDEX_KEY: "bb".repeat(32),
    CRON_SECRET: "cron-secret",
    ...overrides,
  };
}

describe("parseEnv", () => {
  it("happy: parses a complete valid object and returns a frozen typed env", () => {
    const env = parseEnv(validEnv({ AI_PROVIDER_API_KEY: "sk-test-123" }));

    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.SESSION_SECRET).toBe("super-secret");
    expect(env.ENCRYPTION_KEY).toBe("aa".repeat(32));
    expect(env.BLIND_INDEX_KEY).toBe("bb".repeat(32));
    expect(env.CRON_SECRET).toBe("cron-secret");
    expect(env.aiEnabled).toBe(true);
    expect(env.APP_TIMEZONE).toBe("Asia/Tehran");
    expect(Object.isFrozen(env)).toBe(true);
  });

  it("happy: optional AI key empty means aiEnabled=false", () => {
    const env = parseEnv(validEnv());
    expect(env.AI_PROVIDER_API_KEY).toBe("");
    expect(env.aiEnabled).toBe(false);
  });

  it("edge: missing ENCRYPTION_KEY throws a descriptive error", () => {
    const source = validEnv();
    delete (source as Record<string, string | undefined>).ENCRYPTION_KEY;

    expect(() => parseEnv(source)).toThrowError(/ENCRYPTION_KEY/);
  });

  it("edge: BLIND_INDEX_KEY with only 31 bytes (62 hex chars) throws", () => {
    const source = validEnv({ BLIND_INDEX_KEY: "bb".repeat(31) });

    expect(() => parseEnv(source)).toThrowError(/BLIND_INDEX_KEY/);
  });

  it("edge: invalid DATABASE_URL throws a descriptive error", () => {
    const source = validEnv({ DATABASE_URL: "not-a-url" });

    expect(() => parseEnv(source)).toThrowError(/DATABASE_URL/);
  });

  it("edge: multiple missing required vars lists all of them", () => {
    const source = validEnv();
    delete (source as Record<string, string | undefined>).ENCRYPTION_KEY;
    delete (source as Record<string, string | undefined>).SESSION_SECRET;

    expect(() => parseEnv(source)).toThrowError(/ENCRYPTION_KEY/);
    try {
      parseEnv(source);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("SESSION_SECRET");
      expect(msg).toContain("ENCRYPTION_KEY");
    }
  });
});
