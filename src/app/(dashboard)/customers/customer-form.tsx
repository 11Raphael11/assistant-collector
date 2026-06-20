"use client";

import { useActionState } from "react";
import {
  type CustomerFormState,
  createCustomerAction,
  updateCustomerAction,
} from "./actions";

interface CreateProps {
  mode: "create";
}

interface EditProps {
  mode: "edit";
  customerId: string;
  initialValues: {
    name: string;
    phone: string;
  };
}

type CustomerFormProps = CreateProps | EditProps;

const EMPTY_STATE: CustomerFormState = {};

export function CustomerForm(props: CustomerFormProps) {
  const action =
    props.mode === "edit"
      ? updateCustomerAction.bind(null, props.customerId)
      : createCustomerAction;

  const [state, formAction, isPending] = useActionState(action, EMPTY_STATE);

  const initial = props.mode === "edit" ? props.initialValues : undefined;

  return (
    <form
      action={formAction}
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}
    >
      <div>
        <label htmlFor="name" style={{ display: "block", marginBottom: 4 }}>
          نام و نام خانوادگی
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initial?.name}
          required
          minLength={1}
          maxLength={100}
          disabled={isPending}
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      <div>
        <label htmlFor="phone" style={{ display: "block", marginBottom: 4 }}>
          شماره موبایل
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={initial?.phone}
          required
          disabled={isPending}
          dir="ltr"
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      <div>
        <label htmlFor="nationalId" style={{ display: "block", marginBottom: 4 }}>
          کد ملی (اختیاری)
        </label>
        <input
          id="nationalId"
          name="nationalId"
          disabled={isPending}
          dir="ltr"
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      {state.error && (
        <p role="alert" style={{ color: "red", margin: 0 }}>
          {state.error}
        </p>
      )}

      {state.success && (
        <p role="status" style={{ color: "green", margin: 0 }}>
          مشتری با موفقیت {props.mode === "edit" ? "ویرایش" : "ثبت"} شد.
        </p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending
          ? "در حال ارسال..."
          : props.mode === "edit"
            ? "ذخیره تغییرات"
            : "ثبت مشتری"}
      </button>
    </form>
  );
}
