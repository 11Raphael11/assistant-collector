import { CustomerForm } from "../customer-form";

export const metadata = { title: "افزودن مشتری جدید | وصول‌یار" };

export default function NewCustomerPage() {
  return (
    <div>
      <h2>افزودن مشتری جدید</h2>
      <CustomerForm mode="create" />
    </div>
  );
}
