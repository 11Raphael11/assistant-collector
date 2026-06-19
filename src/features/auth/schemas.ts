import { z } from "zod";
import { toLatinDigits } from "@/lib/digits";

const MIN_PASSWORD_LENGTH = 8;

export const registerSchema = z.object({
  businessName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "نام کسب‌وکار الزامی است"),
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v.trim()) : v),
    z.string().min(1, "شماره موبایل الزامی است"),
  ),
  password: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v) : v),
    z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `رمز عبور حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`,
      ),
  ),
});

export const loginPhoneSchema = z.object({
  phone: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v.trim()) : v),
    z.string().min(1, "شماره موبایل الزامی است"),
  ),
  password: z
    .preprocess(
      (v) => (typeof v === "string" ? toLatinDigits(v) : v),
      z.string().min(1, "رمز عبور الزامی است"),
    )
    .optional(),
});

export const otpVerifySchema = z.object({
  phone: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v.trim()) : v),
    z.string().min(1, "شماره موبایل الزامی است"),
  ),
  code: z.preprocess(
    (v) => (typeof v === "string" ? toLatinDigits(v.trim()) : v),
    z.string().length(5, "کد تأیید باید ۵ رقمی باشد"),
  ),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginPhoneInput = z.input<typeof loginPhoneSchema>;
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;
