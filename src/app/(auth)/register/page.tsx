"use client";

import { useActionState, useState } from "react";
import { registerSchema } from "@/features/auth/schemas";
import { registerAction, requestOtpAction, verifyOtpAction, type ActionResult } from "../actions";

const initialState: ActionResult = { ok: false };

function validateRegisterClient(formData: FormData): string | null {
  const result = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!result.success) {
    return result.error.issues.map((i) => i.message).join("، ");
  }
  return null;
}

export default function RegisterPage() {
  const [step, setStep] = useState<"register" | "otp">("register");
  const [phone, setPhone] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const [regState, regAction, regPending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      setClientError(null);
      const validationError = validateRegisterClient(formData);
      if (validationError) {
        setClientError(validationError);
        return { ok: false } as ActionResult;
      }
      const result = await registerAction(_prev, formData);
      if (result.ok && result.phone) {
        setPhone(result.phone);
        setStep("otp");
      }
      return result;
    },
    initialState,
  );

  const [otpState, otpAction, otpPending] = useActionState(verifyOtpAction, initialState);
  const [resendState, resendAction, resendPending] = useActionState(requestOtpAction, initialState);

  if (step === "otp") {
    return (
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>تأیید شماره موبایل</h1>
        <p style={{ marginBottom: 16, color: "#666" }}>
          کد ۵ رقمی ارسال‌شده به {phone} را وارد کنید
        </p>

        <form action={otpAction}>
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

          {otpState.error && (
            <p role="alert" style={{ color: "red", marginBottom: 8 }}>
              {otpState.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={otpPending}
            style={{
              width: "100%",
              padding: 12,
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 16,
              cursor: otpPending ? "not-allowed" : "pointer",
            }}
          >
            {otpPending ? "در حال بررسی..." : "تأیید و ورود"}
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

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <a href="/login" style={{ color: "#2563eb" }}>
            ورود با حساب موجود
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>ثبت‌نام</h1>

      <form action={regAction}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="businessName" style={{ display: "block", marginBottom: 4 }}>
            نام کسب‌وکار
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
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

        {(clientError ?? regState.error) && (
          <p role="alert" style={{ color: "red", marginBottom: 8 }}>
            {clientError ?? regState.error?.message}
          </p>
        )}

        <button
          type="submit"
          disabled={regPending}
          style={{
            width: "100%",
            padding: 12,
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: regPending ? "not-allowed" : "pointer",
          }}
        >
          {regPending ? "در حال ثبت‌نام..." : "ثبت‌نام"}
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: "center" }}>
        حساب دارید؟{" "}
        <a href="/login" style={{ color: "#2563eb" }}>
          ورود
        </a>
      </p>
    </div>
  );
}
