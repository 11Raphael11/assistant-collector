import { z } from "zod";
import { prisma } from "@/server/db";
import { normalizePhone } from "@/lib/phone";
import { blindIndex, encryptPII, last4 } from "@/lib/crypto";
import { toLatinDigits } from "@/lib/digits";
import { logger } from "@/lib/logger";
import { ok, err, type Result } from "@/lib/result";
import { parseOrError } from "@/lib/validation";
import { hashPassword } from "./password";
import { requestOtp } from "./otp";
import { type SmsProvider } from "@/providers/sms/types";

const MIN_PASSWORD_LENGTH = 8;

const registerSchema = z.object({
  businessName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "Business name is required"),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v.trim()) : v),
    z.string(),
  ),
  password: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v) : v),
    z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  ),
});

type RegisterInput = z.input<typeof registerSchema>;

export async function register(
  input: RegisterInput,
  smsProvider: SmsProvider,
): Promise<Result<{ phone: string }>> {
  const parsed = parseOrError(registerSchema, input);
  if (!parsed.ok) return err("VALIDATION", parsed.error.message);

  const { businessName, phone: rawPhone, password } = parsed.value;

  const phoneResult = normalizePhone(rawPhone);
  if (!phoneResult.ok) return phoneResult;
  const phone = phoneResult.value;

  const passwordResult = await hashPassword(password);
  if (!passwordResult.ok) return passwordResult;
  const pwHash = passwordResult.value;

  const phoneH = blindIndex(phone);
  const phoneE = encryptPII(phone);
  const phoneL4 = last4(phone);

  const existing = await prisma.user.findUnique({
    where: { phoneHash: phoneH },
  });
  if (existing) {
    return err("PHONE_TAKEN", "A user with this phone already exists");
  }

  let businessId: string | undefined;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          type: "general",
        },
      });

      await tx.user.create({
        data: {
          businessId: business.id,
          phoneEnc: Buffer.from(phoneE, "utf8"),
          phoneHash: phoneH,
          phoneLast4: phoneL4,
          passwordHash: pwHash,
          role: "owner",
        },
      });

      return { businessId: business.id };
    });
    businessId = result.businessId;
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as Record<string, unknown>).code === "P2002"
    ) {
      return err("PHONE_TAKEN", "A user with this phone already exists");
    }
    throw e;
  }

  const otpResult = await requestOtp(phone, smsProvider);
  if (!otpResult.ok) {
    logger.error(
      { phoneLast4: phoneL4, action: "register_otp_failed" },
      "OTP send failed after registration; rolling back",
    );
    await prisma.user.deleteMany({ where: { phoneHash: phoneH } }).catch(() => undefined);
    await prisma.business.delete({ where: { id: businessId } }).catch(() => undefined);
    return otpResult;
  }

  logger.info(
    { phoneLast4: phoneL4, action: "register_success" },
    "Business + owner registered, OTP sent",
  );

  return ok({ phone });
}
