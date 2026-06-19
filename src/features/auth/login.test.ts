import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { blindIndex, encryptPII, last4 } from "@/lib/crypto";
import { requestOtp } from "./otp";
import { hashPassword } from "./password";
import { loginWithPassword, loginWithOtp } from "./login";
import { MockSmsProvider } from "@/providers/sms/mock";

const TEST_PHONE = "09129998877";
const TEST_PASSWORD = "securePass123";
const TEST_PHONE_HASH = blindIndex(TEST_PHONE);

let testUserId: string;
let testBusinessId: string;

async function cleanup(): Promise<void> {
  await prisma.session.deleteMany({ where: { user: { phoneHash: TEST_PHONE_HASH } } });
  await prisma.otpCode.deleteMany({ where: { phoneHash: TEST_PHONE_HASH } });
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${"login:%" + TEST_PHONE_HASH + "%"}
  `;
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${"otp:" + TEST_PHONE_HASH}
  `;
  await prisma.user.deleteMany({ where: { phoneHash: TEST_PHONE_HASH } });
}

async function seedUser(): Promise<void> {
  const pwResult = await hashPassword(TEST_PASSWORD);
  if (!pwResult.ok) throw new Error("hash failed");

  const business = await prisma.business.create({
    data: { name: "Login Test Biz", type: "general" },
  });

  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      phoneEnc: Buffer.from(encryptPII(TEST_PHONE), "utf8"),
      phoneHash: TEST_PHONE_HASH,
      phoneLast4: last4(TEST_PHONE),
      passwordHash: pwResult.value,
      role: "owner",
    },
  });

  testUserId = user.id;
  testBusinessId = business.id;
}

describe("features/auth/login", () => {
  beforeAll(async () => {
    await cleanup();
    await seedUser();
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.otpCode.deleteMany({ where: { phoneHash: TEST_PHONE_HASH } });
    await prisma.$executeRaw`
      DELETE FROM "RateBucket" WHERE "key" LIKE ${"login:%" + TEST_PHONE_HASH + "%"}
    `;
    await prisma.$executeRaw`
      DELETE FROM "RateBucket" WHERE "key" LIKE ${"otp:" + TEST_PHONE_HASH}
    `;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.business.deleteMany({ where: { id: testBusinessId } });
    await prisma.$disconnect();
  });

  it("happy: loginWithPassword sets a session cookie on valid credentials", async () => {
    const result = await loginWithPassword(TEST_PHONE, TEST_PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.userId).toBe(testUserId);
    expect(result.value.businessId).toBe(testBusinessId);
    expect(result.value.cookie.name).toBe("sid");
    expect(result.value.cookie.httpOnly).toBe(true);
    expect(result.value.cookie.value).toBeTruthy();

    const sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions).toHaveLength(1);
  });

  it("happy: loginWithOtp sets a session on valid OTP", async () => {
    const sms = new MockSmsProvider();
    await requestOtp(TEST_PHONE, sms);
    const code = sms.sent[0].body.match(/(\d{5})/)![1];

    const result = await loginWithOtp(TEST_PHONE, code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.userId).toBe(testUserId);
    expect(result.value.cookie.name).toBe("sid");

    const sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions).toHaveLength(1);
  });

  it("happy: each login creates a distinct session id", async () => {
    const r1 = await loginWithPassword(TEST_PHONE, TEST_PASSWORD);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const cookie1 = r1.value.cookie.value;

    const r2 = await loginWithPassword(TEST_PHONE, TEST_PASSWORD);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const cookie2 = r2.value.cookie.value;

    expect(cookie1).not.toBe(cookie2);
  });

  it("edge (#19 brute force): 6th login attempt/min returns RATE_LIMITED", async () => {
    for (let i = 0; i < 5; i++) {
      await loginWithPassword(TEST_PHONE, "wrongPassword!");
    }

    const blocked = await loginWithPassword(TEST_PHONE, TEST_PASSWORD);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.code).toBe("RATE_LIMITED");
    }
  });

  it("edge: wrong password returns generic INVALID_CREDENTIALS (no enumeration)", async () => {
    const result = await loginWithPassword(TEST_PHONE, "wrongPass999");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CREDENTIALS");
      expect(result.error.message).not.toMatch(/not found/i);
    }
  });

  it("edge: unknown phone returns generic INVALID_CREDENTIALS (no enumeration)", async () => {
    const result = await loginWithPassword("09111111111", "anyPassword1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("edge: wrong OTP returns generic INVALID_CREDENTIALS", async () => {
    const sms = new MockSmsProvider();
    await requestOtp(TEST_PHONE, sms);

    const result = await loginWithOtp(TEST_PHONE, "00000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CREDENTIALS");
    }
  });
});
