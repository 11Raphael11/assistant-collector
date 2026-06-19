import { prisma } from "@/server/db";
import { checkRateLimit } from "@/server/rate-limit";
import { createSession } from "@/server/session";
import { normalizePhone } from "@/lib/phone";
import { blindIndex } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { ok, err, type Result } from "@/lib/result";
import { type CookieOptions } from "@/server/session";
import { verifyOtp } from "./otp";
import { verifyPassword } from "./password";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_SEC = 60;

const GENERIC_LOGIN_ERROR = "INVALID_CREDENTIALS" as const;
const GENERIC_LOGIN_MSG = "Invalid phone, password, or code";

interface LoginSuccess {
  userId: string;
  businessId: string;
  cookie: CookieOptions;
}

async function rateLimitLogin(
  userId: string,
  phoneHash: string,
): Promise<Result<void>> {
  const key = `login:${userId}|${phoneHash}`;
  return checkRateLimit(key, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_SEC);
}

async function findUserByPhone(
  phoneHash: string,
): Promise<{ id: string; businessId: string; passwordHash: string } | null> {
  return prisma.user.findUnique({
    where: { phoneHash },
    select: { id: true, businessId: true, passwordHash: true },
  });
}

export async function loginWithPassword(
  rawPhone: string,
  password: string,
): Promise<Result<LoginSuccess>> {
  const phoneResult = normalizePhone(rawPhone);
  if (!phoneResult.ok) return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);

  const phoneH = blindIndex(phoneResult.value);
  const user = await findUserByPhone(phoneH);

  if (!user) {
    logger.warn({ phoneLast4: phoneResult.value.slice(-4), action: "login_user_not_found" }, "Login attempt for unknown phone");
    return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);
  }

  const rateResult = await rateLimitLogin(user.id, phoneH);
  if (!rateResult.ok) return rateResult;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    logger.warn({ phoneLast4: phoneResult.value.slice(-4), action: "login_wrong_password" }, "Wrong password");
    return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);
  }

  const sessionResult = await createSession(user.id, user.businessId);
  if (!sessionResult.ok) return sessionResult;

  logger.info({ phoneLast4: phoneResult.value.slice(-4), action: "login_password_success" }, "Password login successful");

  return ok({
    userId: user.id,
    businessId: user.businessId,
    cookie: sessionResult.value,
  });
}

export async function loginWithOtp(
  rawPhone: string,
  code: string,
): Promise<Result<LoginSuccess>> {
  const phoneResult = normalizePhone(rawPhone);
  if (!phoneResult.ok) return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);

  const phoneH = blindIndex(phoneResult.value);
  const user = await findUserByPhone(phoneH);

  if (!user) {
    logger.warn({ phoneLast4: phoneResult.value.slice(-4), action: "login_user_not_found" }, "OTP login attempt for unknown phone");
    return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);
  }

  const rateResult = await rateLimitLogin(user.id, phoneH);
  if (!rateResult.ok) return rateResult;

  const otpResult = await verifyOtp(rawPhone, code);
  if (!otpResult.ok) {
    logger.warn({ phoneLast4: phoneResult.value.slice(-4), action: "login_wrong_otp" }, "Wrong OTP");
    return err(GENERIC_LOGIN_ERROR, GENERIC_LOGIN_MSG);
  }

  const sessionResult = await createSession(user.id, user.businessId);
  if (!sessionResult.ok) return sessionResult;

  logger.info({ phoneLast4: phoneResult.value.slice(-4), action: "login_otp_success" }, "OTP login successful");

  return ok({
    userId: user.id,
    businessId: user.businessId,
    cookie: sessionResult.value,
  });
}
