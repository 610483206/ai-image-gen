import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminUsersTable />
      </div>
    </main>
  );
}