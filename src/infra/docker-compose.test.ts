import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

describe("docker-compose", () => {
  it("happy: docker-compose config is valid", () => {
    const output = execSync("docker compose config", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(output).toContain("postgres:16");
    expect(output).toContain("pgdata");
    expect(output).toContain("pg_isready");
  });

  it("happy: .env.example contains all required keys", () => {
    const content = readFileSync(resolve(ROOT, ".env.example"), "utf-8");

    const requiredKeys = [
      "DATABASE_URL",
      "SESSION_SECRET",
      "ENCRYPTION_KEY",
      "BLIND_INDEX_KEY",
      "CRON_SECRET",
      "KAVENEGAR_API_KEY",
      "KAVENEGAR_OTP_TEMPLATE",
      "MELIPAYAMAK_USER",
      "MELIPAYAMAK_PASS",
      "AI_PROVIDER_API_KEY",
      "AI_PROVIDER_BASE_URL",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
      "OBJECT_STORAGE_ENDPOINT",
      "OBJECT_STORAGE_BUCKET",
      "OBJECT_STORAGE_ACCESS_KEY",
      "OBJECT_STORAGE_SECRET_KEY",
      "OBJECT_STORAGE_REGION",
      "GLITCHTIP_DSN",
      "APP_TIMEZONE",
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });

  it("happy: DATABASE_URL includes connection_limit=10", () => {
    const content = readFileSync(resolve(ROOT, ".env.example"), "utf-8");
    expect(content).toContain("connection_limit=10");
  });

  it("edge: .env is gitignored (no secret leakage)", () => {
    const output = execSync("git check-ignore .env", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(output.trim()).toBe(".env");
  });
});
