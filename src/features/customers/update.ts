import { updateCustomerSchema } from "./schema";
import { createCustomerRepository, type CustomerRowWithPhone } from "./repo";
import { parseOrError } from "../../lib/validation";
import { type Result, ok, err } from "../../lib/result";

export async function updateCustomer(
  businessId: string,
  customerId: string,
  input: unknown,
): Promise<Result<CustomerRowWithPhone>> {
  const parsed = parseOrError(updateCustomerSchema, input);
  if (!parsed.ok) return parsed;

  const patch = parsed.value;

  if (!patch.name && !patch.phone && !patch.nationalId) {
    return err("VALIDATION", "at least one field must be provided");
  }

  const repo = createCustomerRepository(businessId);

  if (patch.phone) {
    const existing = await repo.findByPhoneHash(patch.phone);
    if (existing && existing.id !== customerId) {
      return err("CUSTOMER_EXISTS", "این شماره قبلاً برای مشتری دیگری ثبت شده");
    }
  }

  const updated = await repo.updateCustomer(customerId, {
    name: patch.name,
    phone: patch.phone,
    nationalId: patch.nationalId,
  });

  if (!updated) {
    return err("NOT_FOUND", "مشتری یافت نشد");
  }

  return ok(updated);
}

export async function softDeleteCustomer(
  businessId: string,
  customerId: string,
): Promise<Result<void>> {
  const repo = createCustomerRepository(businessId);

  const deleted = await repo.softDeleteCustomer(customerId);
  if (!deleted) {
    return err("NOT_FOUND", "مشتری یافت نشد");
  }

  return ok(undefined);
}
