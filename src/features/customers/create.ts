import { createCustomerSchema } from "./schema";
import { createCustomerRepository, type CustomerRowWithPhone } from "./repo";
import { parseOrError } from "../../lib/validation";
import { type Result, ok, err } from "../../lib/result";

const UNIQUE_VIOLATION_CODE = "P2002";

export async function createCustomer(
  businessId: string,
  input: unknown,
): Promise<Result<CustomerRowWithPhone>> {
  const parsed = parseOrError(createCustomerSchema, input);
  if (!parsed.ok) return parsed;

  const { name, phone, nationalId } = parsed.value;
  const repo = createCustomerRepository(businessId);

  const existing = await repo.findByPhoneHash(phone);
  if (existing) {
    return err("CUSTOMER_EXISTS", "این مشتری قبلاً ثبت شده");
  }

  try {
    const customer = await repo.insertCustomer({
      name,
      phone,
      nationalId,
    });
    return ok(customer);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === UNIQUE_VIOLATION_CODE
    ) {
      return err("CUSTOMER_EXISTS", "این مشتری قبلاً ثبت شده");
    }
    throw e;
  }
}
