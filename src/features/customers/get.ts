import { createCustomerRepository, type CustomerRowWithPhone } from "./repo";

export async function getCustomerById(
  businessId: string,
  customerId: string,
): Promise<CustomerRowWithPhone | null> {
  const repo = createCustomerRepository(businessId);
  return repo.findCustomerById(customerId);
}
