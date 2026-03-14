import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const sql = getDb();
  const rows = await sql`
    SELECT system_role FROM user_profiles WHERE id = ${session.user.id}
  `;

  const role = (rows[0]?.system_role as string) || "member";
  if (!["admin", "super_admin"].includes(role)) {
    redirect("/");
  }

  return <>{children}</>;
}
