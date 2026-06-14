import { beforeAll, describe, expect, it } from "vitest";
import { blindIndex, decryptPII, encryptPII, last4 } from "./crypto";

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

describe("blindIndex", () => {
  it("happy: deterministic — same input yields same index across calls", () => {
    const a = blindIndex("09123456789");
    const b = blindIndex("09123456789");
    expect(a).toBe(b);
  });

  it("happy: output is lowercase hex of length 64 (sha256)", () => {
    const h = blindIndex("09123456789");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("edge: different inputs produce different indexes", () => {
    expect(blindIndex("09123456789")).not.toBe(blindIndex("09123456788"));
    expect(blindIndex("")).not.toBe(blindIndex("a"));
  });

  it("edge: not equal to plain SHA-256 (keyed HMAC, not raw hash)", () => {
    // sanity: hand-computed sha256 of "x" differs from blindIndex("x")
    const sha256OfX =
      "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881";
    expect(blindIndex("x")).not.toBe(sha256OfX);
  });
});

describe("last4", () => {
  it("happy: returns the final 4 chars of a mobile-like string", () => {
    expect(last4("09123456789")).toBe("6789");
  });

  it("edge: returns the whole string when length <= 4 (no crash)", () => {
    expect(last4("12")).toBe("12");
    expect(last4("1234")).toBe("1234");
    expect(last4("")).toBe("");
  });
});
