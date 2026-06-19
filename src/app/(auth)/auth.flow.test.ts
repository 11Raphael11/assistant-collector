import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://vosool:vosool_dev@localhost:5432/vosool_yar?connection_limit=10";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-secret";
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ?? "aa".repeat(32);
  process.env.BLIND_INDEX_KEY =
    process.env.BLIND_INDEX_KEY ?? "bb".repeat(32);
  process.env.CRON_SECRET = process.env.CRON_SECRET ?? "cron-secret";
});

const TEST_PHONE = "09121234500";
const TEST_PASSWORD = "Str0ngP@ss1";

async function getHelpers() {
  const { prisma } = await import("@/server/db");
  const { register, requestOtp, loginWithOtp } = await import(
    "@/features/auth"
  );
  const { readSession } = await import("@/server/session");
  const { blindIndex } = await import("@/lib/crypto");
  const { MockSmsProvider } = await import("@/providers/sms/mock");
  const { registerSchema, loginPhoneSchema, otpVerifySchema } = await import(
    "@/features/auth/schemas"
  );

  return {
    prisma,
    register,
    requestOtp,
    loginWithOtp,
    readSession,
    blindIndex,
    MockSmsProvider,
    registerSchema,
    loginPhoneSchema,
    otpVerifySchema,
  };
}

async function cleanup(): Promise<void> {
  const { prisma, blindIndex } = await getHelpers();
  const phoneHash = blindIndex(TEST_PHONE);

  await prisma.session.deleteMany({
    where: { user: { phoneHash } },
  });
  await prisma.otpCode.deleteMany({ where: { phoneHash } });
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${`otp:${phoneHash}`}
  `;
  await prisma.$executeRaw`
    DELETE FROM "RateBucket" WHERE "key" LIKE ${`login:%${phoneHash}%`}
  `;
  const user = await prisma.user.findUnique({
    where: { phoneHash },
  });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.business
      .delete({ where: { id: user.businessId } })
      .catch(() => undefined);
  }
}

describe("auth flow (register → OTP → dashboard)", () => {
  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    const { prisma } = await getHelpers();
    await prisma.$disconnect();
  });

  it("happy: register → verify OTP → session created (dashboard accessible)", async () => {
    const { register, loginWithOtp, readSession, MockSmsProvider } =
      await getHelpers();
    const sms = new MockSmsProvider();

    const regResult = await register(
      { businessName: "تست فلو", phone: TEST_PHONE, password: TEST_PASSWORD },
      sms,
    );
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    expect(regResult.value.phone).toBe(TEST_PHONE);

    expect(sms.sent.length).toBeGreaterThanOrEqual(1);
    const otpMsg = sms.sent[sms.sent.length - 1];
    const codeMatch = otpMsg.body.match(/(\d{5})/);
    expect(codeMatch).not.toBeNull();
    const code = codeMatch![1];

    const loginResult = await loginWithOtp(TEST_PHONE, code);
    expect(loginResult.ok).toBe(true);
    if (!loginResult.ok) return;

    expect(loginResult.value.cookie.name).toBe("sid");
    expect(loginResult.value.cookie.httpOnly).toBe(true);
    expect(loginResult.value.cookie.value).toBeTruthy();

    const sessionResult = await readSession(loginResult.value.cookie.value);
    expect(sessionResult.ok).toBe(true);
    if (!sessionResult.ok) return;
    expect(sessionResult.value.userId).toBe(loginResult.value.userId);
    expect(sessionResult.value.businessId).toBe(loginResult.value.businessId);
  });

  it("edge: visiting dashboard without session results in redirect (no valid session)", async () => {
    const { readSession } = await getHelpers();

    const noSession = await readSession("invalid-cookie-value");
    expect(noSession.ok).toBe(false);
    if (!noSession.ok) {
      expect(noSession.error.code).toBe("INVALID_SESSION");
    }

    const emptySession = await readSession("");
    expect(emptySession.ok).toBe(false);
  });

  it("edge: OTP resend rate-limited at 4th try (3/10min limit)", async () => {
    const { register, requestOtp, MockSmsProvider } = await getHelpers();
    const sms = new MockSmsProvider();

    const regResult = await register(
      {
        businessName: "تست محدودیت",
        phone: TEST_PHONE,
        password: TEST_PASSWORD,
      },
      sms,
    );
    expect(regResult.ok).toBe(true);

    const secondOtp = await requestOtp(TEST_PHONE, sms);
    expect(secondOtp.ok).toBe(true);

    const thirdOtp = await requestOtp(TEST_PHONE, sms);
    expect(thirdOtp.ok).toBe(true);

    const fourthOtp = await requestOtp(TEST_PHONE, sms);
    expect(fourthOtp.ok).toBe(false);
    if (!fourthOtp.ok) {
      expect(fourthOtp.error.code).toBe("RATE_LIMITED");
    }
  });

  it("edge: client schemas normalize Persian digits before validation", async () => {
    const { registerSchema, loginPhoneSchema, otpVerifySchema } =
      await getHelpers();

    const persianPhone = "۰۹۱۲۱۲۳۴۵۰۰";
    const regParsed = registerSchema.safeParse({
      businessName: "تست",
      phone: persianPhone,
      password: "Str0ngP@ss1",
    });
    expect(regParsed.success).toBe(true);
    if (regParsed.success) {
      expect(regParsed.data.phone).toBe(TEST_PHONE);
    }

    const loginParsed = loginPhoneSchema.safeParse({
      phone: persianPhone,
      password: "test1234",
    });
    expect(loginParsed.success).toBe(true);
    if (loginParsed.success) {
      expect(loginParsed.data.phone).toBe(TEST_PHONE);
    }

    const otpParsed = otpVerifySchema.safeParse({
      phone: persianPhone,
      code: "۱۲۳۴۵",
    });
    expect(otpParsed.success).toBe(true);
    if (otpParsed.success) {
      expect(otpParsed.data.code).toBe("12345");
    }
  });

  it("edge: client registerSchema rejects short password", async () => {
    const { registerSchema } = await getHelpers();

    const result = registerSchema.safeParse({
      businessName: "تست",
      phone: TEST_PHONE,
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("edge: client otpVerifySchema rejects non-5-digit code", async () => {
    const { otpVerifySchema } = await getHelpers();

    const result = otpVerifySchema.safeParse({
      phone: TEST_PHONE,
      code: "123",
    });
    expect(result.success).toBe(false);
  });
});
