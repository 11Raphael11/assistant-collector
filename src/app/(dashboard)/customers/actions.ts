"use server";

import { requireSession } from "@/features/auth";
import { createCustomer, updateCustomer } from "@/features/customers";
import { revalidatePath } from "next/cache";

export type CustomerFormState = {
  error?: string;
  success?: boolean;
  customerId?: string;
};

export async function createCustomerAction(
  prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await requireSession();

  const nameRaw = formData.get("name");
  const phoneRaw = formData.get("phone");
  const nationalIdRaw = formData.get("nationalId");

  const result = await createCustomer(session.businessId, {
    name: typeof nameRaw === "string" ? nameRaw : "",
    phone: typeof phoneRaw === "string" ? phoneRaw : "",
    nationalId:
      typeof nationalIdRaw === "string" && nationalIdRaw.trim()
        ? nationalIdRaw
        : undefined,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath("/(dashboard)/customers");
  return { success: true, customerId: result.value.id };
}

export async function updateCustomerAction(
  customerId: string,
  prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await requireSession();

  const nameRaw = formData.get("name");
  const phoneRaw = formData.get("phone");
  const nationalIdRaw = formData.get("nationalId");

  const result = await updateCustomer(session.businessId, customerId, {
    name: typeof nameRaw === "string" && nameRaw ? nameRaw : undefined,
    phone: typeof phoneRaw === "string" && phoneRaw ? phoneRaw : undefined,
    nationalId:
      typeof nationalIdRaw === "string" && nationalIdRaw.trim()
        ? nationalIdRaw
        : undefined,
  });

  if (!result.ok) {
    return { error: result.error.message };
  }

  revalidatePath("/(dashboard)/customers");
  return { success: true, customerId: result.value.id };
}
