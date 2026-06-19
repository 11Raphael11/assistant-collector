import { requireSession } from "@/features/auth";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>داشبورد</h2>
      <p style={{ color: "#666" }}>
        خوش آمدید. شناسه کسب‌وکار: {session.businessId}
      </p>
    </div>
  );
}
