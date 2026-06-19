import { createHmac, randomInt } from "node:crypto";
import { prisma } from "@/server/db";
import { checkRateLimit } from "@/server/rate-limit";
import { blindIndex } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { logger } from "@/lib/logger";
import { ok, err, type Result } from "@/lib/result";
import { type SmsProvider } from "@/providers/sms/types";

const OTP_DIGITS = 5;
const OTP_TTL_SEC = 120;
const OTP_RATE_LIMIT = 3;
const OTP_RATE_WINDOW_SEC = 600;

function generateCode(): string {
  const min = 10 ** (OTP_DIGITS - 1);
  const max = 10 ** OTP_DIGITS;
  return String(randomInt(min, max));
}

function hashCode(code: string, phoneHash: string): string {
  return createHmac("sha256", phoneHash).update(code).digest("hex");
}

export async function requestOtp(
  rawPhone: string,
  smsProvider: SmsProvider,
): Promise<Result<void>> {
  const phoneResult = normalizePhone(rawPhone);
  if (!phoneResult.ok) return phoneResult;
  const phone = phoneResult.value;

  const phoneH = blindIndex(phone);
  const rateLimitKey = `otp:${phoneH}`;

  const rateResult = await checkRateLimit(
    rateLimitKey,
    OTP_RATE_LIMIT,
    OTP_RATE_WINDOW_SEC,
  );
  if (!rateResult.ok) return rateResult;

  const code = generateCode();
  const codeH = hashCode(code, phoneH);
  const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);

  await prisma.otpCode.create({
    data: {
      phoneHash: phoneH,
      codeHash: codeH,
      expiresAt,
    },
  });

  const smsResult = await smsProvider.send(
    phone,
    `کد تأیید شما: ${code}`,
  );
  if (!smsResult.ok) {
    logger.error(
      { phoneLast4: phone.slice(-4), action: "otp_sms_failed" },
      "Failed to send OTP SMS",
    );
    return err("SMS_SEND_FAILED", "Could not send OTP SMS");
  }

  logger.info(
    { phoneLast4: phone.slice(-4), action: "otp_requested" },
    "OTP requested",
  );

  return ok(undefined);
}

export async function verifyOtp(
  rawPhone: string,
  code: string,
): Promise<Result<void>> {
  const phoneResult = normalizePhone(rawPhone);
  if (!phoneResult.ok) return phoneResult;
  const phone = phoneResult.value;

  const phoneH = blindIndex(phone);
  const codeH = hashCode(code, phoneH);

  const record = await prisma.otpCode.findFirst({
    where: {
      phoneHash: phoneH,
      codeHash: codeH,
      expiresAt: { gt: new Date() },
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    logger.warn(
      { phoneLast4: phone.slice(-4), action: "otp_verify_failed" },
      "OTP verification failed",
    );
    return err("INVALID_OTP", "Wrong, expired, or already used code");
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  logger.info(
    { phoneLast4: phone.slice(-4), action: "otp_verified" },
    "OTP verified",
  );

  return ok(undefined);
}
