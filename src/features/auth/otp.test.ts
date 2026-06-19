import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { requestOtp, verifyOtp } from "./otp";
import { MockSmsProvider } from "@/providers/sms/mock";
import { blindIndex } from "@/lib/crypto";

const TEST_PHONE = "09121234567";
const TEST_PHONE_HASH = blindIndex(TEST_PHONE);

async function cleanup(): Promise<void> {
  await prisma.otpCode.deleteMany({
    where: { phoneHash: TEST_PHONE_HASH },
  });
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${"otp:" + TEST_PHONE_HASH}
  `;
}

describe("features/auth/otp", () => {
  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("happy: request → verify with the right code succeeds and consumes it", async () => {
    const sms = new MockSmsProvider();

    const reqResult = await requestOtp(TEST_PHONE, sms);
    expect(reqResult.ok).toBe(true);
    expect(sms.sent).toHaveLength(1);

    const sentBody = sms.sent[0].body;
    const codeMatch = sentBody.match(/(\d{5})/);
    expect(codeMatch).not.toBeNull();
    const code = codeMatch![1];

    const verifyResult = await verifyOtp(TEST_PHONE, code);
    expect(verifyResult.ok).toBe(true);

    const reuse = await verifyOtp(TEST_PHONE, code);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) {
      expect(reuse.error.code).toBe("INVALID_OTP");
    }
  });

  it("edge: 4th request within 10 min for the same phone returns RATE_LIMITED", async () => {
    const sms = new MockSmsProvider();

    for (let i = 0; i < 3; i++) {
      const r = await requestOtp(TEST_PHONE, sms);
      expect(r.ok).toBe(true);
    }

    const blocked = await requestOtp(TEST_PHONE, sms);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe("RATE_LIMITED");
    }
  });

  it("edge: codes are stored hashed, never plaintext", async () => {
    const sms = new MockSmsProvider();

    await requestOtp(TEST_PHONE, sms);

    const sentBody = sms.sent[0].body;
    const code = sentBody.match(/(\d{5})/)![1];

    const rows = await prisma.otpCode.findMany({
      where: { phoneHash: TEST_PHONE_HASH },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toBe(code);
    expect(rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("edge: wrong code returns INVALID_OTP", async () => {
    const sms = new MockSmsProvider();
    await requestOtp(TEST_PHONE, sms);

    const result = await verifyOtp(TEST_PHONE, "00000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OTP");
    }
  });

  it("edge: expired code returns INVALID_OTP", async () => {
    const sms = new MockSmsProvider();
    await requestOtp(TEST_PHONE, sms);

    const sentBody = sms.sent[0].body;
    const code = sentBody.match(/(\d{5})/)![1];

    await prisma.otpCode.updateMany({
      where: { phoneHash: TEST_PHONE_HASH },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await verifyOtp(TEST_PHONE, code);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_OTP");
    }
  });

  it("edge: SMS failure returns SMS_SEND_FAILED", async () => {
    const sms = new MockSmsProvider({ shouldFail: true });

    const result = await requestOtp(TEST_PHONE, sms);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SMS_SEND_FAILED");
    }
  });

  it("edge: Persian digits in phone are normalized before processing", async () => {
    const sms = new MockSmsProvider();
    const persianPhone = "۰۹۱۲۱۲۳۴۵۶۷";

    const result = await requestOtp(persianPhone, sms);
    expect(result.ok).toBe(true);
    expect(sms.sent[0].to).toBe(TEST_PHONE);
  });
});
