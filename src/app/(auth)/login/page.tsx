"use client";

import { useActionState, useState } from "react";
import { loginPhoneSchema, otpVerifySchema } from "@/features/auth/schemas";
import {
  loginPasswordAction,
  requestOtpAction,
  verifyOtpAction,
  type ActionResult,
} from "../actions";

const initialState: ActionResult = { ok: false };

function validateLoginClient(formData: FormData): string | null {
  const result = loginPhoneSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!result.success) {
    return result.error.issues.map((i) => i.message).join("، ");
  }
  return null;
}

function validateOtpClient(formData: FormData): string | null {
  const result = otpVerifySchema.safeParse({
    phone: formData.get("phone"),
    code: formData.get("code"),
  });
  if (!result.success) {
    return result.error.issues.map((i) => i.message).join("، ");
  }
  return null;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const [pwState, pwAction, pwPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      setClientError(null);
      const validationError = validateLoginClient(formData);
      if (validationError) {
        setClientError(validationError);
        return { ok: false } as ActionResult;
      }
      return loginPasswordAction(_prev, formData);
    },
    initialState,
  );

  const [otpReqState, otpReqAction, otpReqPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      setClientError(null);
      const phoneVal = formData.get("phone");
      if (typeof phoneVal !== "string" || phoneVal.trim().length === 0) {
        setClientError("شماره موبایل الزامی است");
        return { ok: false } as ActionResult;
      }
      const result = await requestOtpAction(_prev, formData);
      if (result.ok) {
        setPhone(phoneVal as string);
        setOtpStep("code");
      }
      return result;
    },
    initialState,
  );

  const [otpVerifyState, otpVerifyAction, otpVerifyPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      setClientError(null);
      const validationError = validateOtpClient(formData);
      if (validationError) {
        setClientError(validationError);
        return { ok: false } as ActionResult;
      }
      return verifyOtpAction(_prev, formData);
    },
    initialState,
  );

  const [resendState, resendAction, resendPending] = useActionState(
    requestOtpAction,
    initialState,
  );

  if (mode === "otp" && otpStep === "code") {
    return (
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>ورود با کد یکبار مصرف</h1>
        <p style={{ marginBottom: 16, color: "#666" }}>
          کد ۵ رقمی ارسال‌شده به {phone} را وارد کنید
        </p>

        <form action={otpVerifyAction}>
          <input type="hidden" name="phone" value={phone} />
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="code" style={{ display: "block", marginBottom: 4 }}>
              کد تأیید
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={5}
              dir="ltr"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: 18,
                textAlign: "center",
                letterSpacing: 8,
                boxSizing: "border-box",
              }}
            />
          </div>

          {(clientError ?? otpVerifyState.error) && (
            <p role="alert" style={{ color: "red", marginBottom: 8 }}>
              {clientError ?? otpVerifyState.error?.message}
            </p>
          )}

          <button
            type="submit"
            disabled={otpVerifyPending}
            style={{
              width: "100%",
              padding: 12,
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              cursor: otpVerifyPending ? "not-allowed" : "pointer",
            }}
          >
            {otpVerifyPending ? "در حال بررسی..." : "تأیید و ورود"}
          </button>
        </form>

        <form action={resendAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="phone" value={phone} />
          <button
            type="submit"
            disabled={resendPending}
            style={{
              width: "100%",
              padding: 10,
              backgroundColor: "transparent",
              color: "#2563eb",
              border: "1px solid #2563eb",
              borderRadius: 6,
              fontSize: 14,
              cursor: resendPending ? "not-allowed" : "pointer",
            }}
          >
            {resendPending ? "در حال ارسال..." : "ارسال مجدد کد"}
          </button>
        </form>

        {resendState.error && (
          <p role="alert" style={{ color: "red", marginTop: 8 }}>
            {resendState.error.code === "RATE_LIMITED"
              ? "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۰ دقیقه صبر کنید."
              : resendState.error.message}
          </p>
        )}
        {resendState.ok && (
          <p style={{ color: "green", marginTop: 8 }}>کد جدید ارسال شد</p>
        )}

        <button
          type="button"
          onClick={() => {
            setOtpStep("phone");
            setClientError(null);
          }}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 10,
            backgroundColor: "transparent",
            color: "#666",
            border: "none",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          بازگشت
        </button>
      </div>
    );
  }

  if (mode === "otp") {
    return (
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>ورود با کد یکبار مصرف</h1>

        <form action={otpReqAction}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="phone" style={{ display: "block", marginBottom: 4 }}>
              شماره موبایل
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              required
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 6,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </div>

          {(clientError ?? otpReqState.error) && (
            <p role="alert" style={{ color: "red", marginBottom: 8 }}>
              {clientError ??
                (otpReqState.error?.code === "RATE_LIMITED"
                  ? "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۰ دقیقه صبر کنید."
                  : otpReqState.error?.message)}
            </p>
          )}

          <button
            type="submit"
            disabled={otpReqPending}
            style={{
              width: "100%",
              padding: 12,
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              cursor: otpReqPending ? "not-allowed" : "pointer",
            }}
          >
            {otpReqPending ? "در حال ارسال..." : "ارسال کد"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode("password");
            setClientError(null);
          }}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 10,
            backgroundColor: "transparent",
            color: "#2563eb",
            border: "none",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ورود با رمز عبور
        </button>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          حساب ندارید؟{" "}
          <a href="/register" style={{ color: "#2563eb" }}>
            ثبت‌نام
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>ورود</h1>

      <form action={pwAction}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="phone" style={{ display: "block", marginBottom: 4 }}>
            شماره موبایل
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            required
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: "block", marginBottom: 4 }}>
            رمز عبور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            dir="ltr"
            required
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />
        </div>

        {(clientError ?? pwState.error) && (
          <p role="alert" style={{ color: "red", marginBottom: 8 }}>
            {clientError ?? pwState.error?.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pwPending}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: pwPending ? "not-allowed" : "pointer",
          }}
        >
          {pwPending ? "در حال ورود..." : "ورود"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode("otp");
          setClientError(null);
        }}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 10,
          backgroundColor: "transparent",
          color: "#2563eb",
          border: "none",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        ورود با کد یکبار مصرف
      </button>

      <p style={{ marginTop: 16, textAlign: "center" }}>
        حساب ندارید؟{" "}
        <a href="/register" style={{ color: "#2563eb" }}>
          ثبت‌نام
        </a>
      </p>
    </div>
  );
}
