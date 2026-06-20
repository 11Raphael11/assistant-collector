import { notFound } from "next/navigation";
import { requireSession } from "@/features/auth";
import { getCustomerById } from "@/features/customers";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "ویرایش مشتری | وصول‌یار" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession();
  const customer = await getCustomerById(session.businessId, id);

  if (!customer) {
    notFound();
  }

  return (
    <div>
      <h2>ویرایش مشتری</h2>
      <CustomerForm
        mode="edit"
        customerId={id}
        initialValues={{
          name: customer.name,
          phone: customer.phone,
        }}
      />
    </div>
  );
}
