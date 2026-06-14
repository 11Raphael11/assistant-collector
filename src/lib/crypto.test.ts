import { beforeAll, describe, expect, it } from "vitest";
import { decryptPII, encryptPII } from "./crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  process.env.SESSION_SECRET = "super-secret";
  process.env.ENCRYPTION_KEY = "aa".repeat(32);
  process.env.BLIND_INDEX_KEY = "bb".repeat(32);
  process.env.CRON_SECRET = "cron-secret";
});

describe("encryptPII / decryptPII", () => {
  it("happy: round-trip restores the original plaintext", () => {
    const plain = "09120000000";
    const token = encryptPII(plain);
    const result = decryptPII(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(plain);
    }
  });

  it("happy: ciphertext is non-deterministic for the same plaintext (random IV)", () => {
    const plain = "0012345678";
    const a = encryptPII(plain);
    const b = encryptPII(plain);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
    expect(b.startsWith("v1:")).toBe(true);
  });

  it("happy: handles unicode/persian plaintext", () => {
    const plain = "کد ملی ۱۲۳";
    const token = encryptPII(plain);
    const result = decryptPII(token);
    expect(result.ok && result.value).toBe(plain);
  });

  it("edge: tampered ciphertext returns err and does not throw", () => {
    const token = encryptPII("09120000000");
    const parts = token.split(":");
    const cipherBuf = Buffer.from(parts[3], "base64");
    cipherBuf[0] = cipherBuf[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${cipherBuf.toString("base64")}`;
    const result = decryptPII(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DECRYPT_FAILED");
    }
  });

  it("edge: tampered auth tag returns err", () => {
    const token = encryptPII("09120000000");
    const parts = token.split(":");
    const tagBuf = Buffer.from(parts[2], "base64");
    tagBuf[0] = tagBuf[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${tagBuf.toString("base64")}:${parts[3]}`;
    const result = decryptPII(tampered);
    expect(result.ok).toBe(false);
  });

  it("edge: malformed token string returns err and does not throw", () => {
    expect(decryptPII("").ok).toBe(false);
    expect(decryptPII("not-a-token").ok).toBe(false);
    expect(decryptPII("v2:a:b:c").ok).toBe(false);
    expect(decryptPII("v1:a:b").ok).toBe(false);
    expect(decryptPII("v1:!!!:!!!:!!!").ok).toBe(false);
  });
});
