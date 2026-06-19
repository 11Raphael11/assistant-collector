import { requireSession } from "@/features/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div style={{ minHeight: "100vh", direction: "rtl" }}>
      <header
        style={{
          backgroundColor: "#1e293b",
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>وصول‌یار</h1>
        <span style={{ fontSize: 14, color: "#94a3b8" }}>
          {session.businessId.slice(0, 8)}...
        </span>
      </header>

      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
