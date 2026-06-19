"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { register } from "@/features/auth";
import { loginWithPassword, loginWithOtp, requestOtp } from "@/features/auth";
import { parseOrError } from "@/lib/validation";
import {
  registerSchema,
  loginPhoneSchema,
  otpVerifySchema,
} from "@/features/auth/schemas";
import { getSmsSender } from "@/providers/sms";
import { type AppError } from "@/lib/result";

export interface ActionResult {
  ok: boolean;
  error?: AppError;
  phone?: string;
}

export async function registerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    businessName: formData.get("businessName"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  };

  const parsed = parseOrError(registerSchema, raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const sms = getSmsSender();
  const result = await register(parsed.value, sms);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, phone: result.value.phone };
}

export async function loginPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    phone: formData.get("phone"),
    password: formData.get("password"),
  };

  const parsed = parseOrError(loginPhoneSchema, raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const result = await loginWithPassword(
    parsed.value.phone,
    parsed.value.password ?? "",
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const jar = await cookies();
  jar.set(result.value.cookie.name, result.value.cookie.value, {
    httpOnly: result.value.cookie.httpOnly,
    secure: result.value.cookie.secure,
    sameSite: result.value.cookie.sameSite,
    path: result.value.cookie.path,
    maxAge: result.value.cookie.maxAge,
  });

  redirect("/dashboard");
}

export async function requestOtpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const phone = formData.get("phone");
  if (typeof phone !== "string" || phone.trim().length === 0) {
    return { ok: false, error: { code: "VALIDATION", message: "شماره موبایل الزامی است" } };
  }

  const sms = getSmsSender();
  const result = await requestOtp(phone, sms);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function verifyOtpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    phone: formData.get("phone"),
    code: formData.get("code"),
  };

  const parsed = parseOrError(otpVerifySchema, raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const result = await loginWithOtp(parsed.value.phone, parsed.value.code);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const jar = await cookies();
  jar.set(result.value.cookie.name, result.value.cookie.value, {
    httpOnly: result.value.cookie.httpOnly,
    secure: result.value.cookie.secure,
    sameSite: result.value.cookie.sameSite,
    path: result.value.cookie.path,
    maxAge: result.value.cookie.maxAge,
  });

  redirect("/dashboard");
}
