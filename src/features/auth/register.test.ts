import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/server/db";
import { register } from "./register";
import { MockSmsProvider } from "@/providers/sms/mock";
import { blindIndex } from "@/lib/crypto";

const TEST_PHONE = "09331112233";
const TEST_PHONE_HASH = blindIndex(TEST_PHONE);

async function cleanup(): Promise<void> {
  await prisma.otpCode.deleteMany({ where: { phoneHash: TEST_PHONE_HASH } });
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${"otp:" + TEST_PHONE_HASH}
  `;
  const user = await prisma.user.findUnique({ where: { phoneHash: TEST_PHONE_HASH } });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.business.delete({ where: { id: user.businessId } }).catch(() => undefined);
  }
}

describe("features/auth/register", () => {
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

  it("happy: valid input creates Business + User and triggers OTP", async () => {
    const sms = new MockSmsProvider();

    const result = await register(
      { businessName: "فروشگاه تست", phone: "09331112233", password: "Str0ngP@ss" },
      sms,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe(TEST_PHONE);
    }

    const user = await prisma.user.findUnique({ where: { phoneHash: TEST_PHONE_HASH } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe("owner");
    expect(user!.phoneLast4).toBe("2233");
    expect(user!.passwordHash).not.toBe("Str0ngP@ss");

    const business = await prisma.business.findUnique({ where: { id: user!.businessId } });
    expect(business).not.toBeNull();
    expect(business!.name).toBe("فروشگاه تست");

    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].to).toBe(TEST_PHONE);
  });

  it("edge: duplicate phone returns PHONE_TAKEN", async () => {
    const sms = new MockSmsProvider();

    const first = await register(
      { businessName: "بیزنس ۱", phone: "09331112233", password: "Str0ngP@ss" },
      sms,
    );
    expect(first.ok).toBe(true);

    const second = await register(
      { businessName: "بیزنس ۲", phone: "09331112233", password: "An0therP@ss" },
      sms,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("PHONE_TAKEN");
    }
  });

  it("edge: OTP send failure rolls back Business + User", async () => {
    const sms = new MockSmsProvider({ shouldFail: true });

    const result = await register(
      { businessName: "بیزنس تست", phone: "09331112233", password: "Str0ngP@ss" },
      sms,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SMS_SEND_FAILED");
    }

    const user = await prisma.user.findUnique({ where: { phoneHash: TEST_PHONE_HASH } });
    expect(user).toBeNull();
  });

  it("edge: short password returns VALIDATION", async () => {
    const sms = new MockSmsProvider();

    const result = await register(
      { businessName: "تست", phone: "09331112233", password: "short" },
      sms,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });

  it("edge: invalid phone returns INVALID_PHONE", async () => {
    const sms = new MockSmsProvider();

    const result = await register(
      { businessName: "تست", phone: "12345", password: "Str0ngP@ss" },
      sms,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PHONE");
    }
  });

  it("edge: empty business name returns VALIDATION", async () => {
    const sms = new MockSmsProvider();

    const result = await register(
      { businessName: "  ", phone: "09331112233", password: "Str0ngP@ss" },
      sms,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });

  it("edge: Persian digits in phone are normalized", async () => {
    const sms = new MockSmsProvider();

    const result = await register(
      { businessName: "تست", phone: "۰۹۳۳۱۱۱۲۲۳۳", password: "Str0ngP@ss" },
      sms,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe(TEST_PHONE);
    }
  });
});
