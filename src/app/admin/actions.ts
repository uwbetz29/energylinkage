"use server";

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  system_role: string;
  provider: string;
  created_at: string;
  last_sign_in_at: string | null;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const sql = getDb();
  const rows = await sql`
    SELECT system_role FROM user_profiles WHERE id = ${session.user.id}
  `;

  const role = (rows[0]?.system_role as string) || "member";
  if (!["admin", "super_admin"].includes(role)) {
    throw new Error("Not authorized");
  }

  return { userId: session.user.id, role };
}

export async function listUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  const sql = getDb();

  const rows = await sql`
    SELECT id, email, display_name, avatar_url, system_role, provider,
           created_at, last_sign_in_at
    FROM user_profiles
    ORDER BY created_at DESC
  `;

  return rows as unknown as AdminUser[];
}

export async function updateUserRole(userId: string, newRole: string) {
  const { userId: myId, role: myRole } = await requireAdmin();

  if (newRole === "super_admin" && myRole !== "super_admin") {
    throw new Error("Only super admins can promote to super admin");
  }
  if (userId === myId) {
    throw new Error("Cannot change your own role");
  }

  const sql = getDb();

  const target = await sql`
    SELECT system_role FROM user_profiles WHERE id = ${userId}
  `;
  if (target[0]?.system_role === "super_admin" && myRole !== "super_admin") {
    throw new Error("Cannot modify a super admin");
  }

  await sql`
    UPDATE user_profiles
    SET system_role = ${newRole}, updated_at = now()
    WHERE id = ${userId}
  `;
}

export async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: string
) {
  const { role: myRole } = await requireAdmin();

  if (role === "super_admin" && myRole !== "super_admin") {
    throw new Error("Only super admins can create super admins");
  }

  const sql = getDb();

  const existing = await sql`
    SELECT id FROM user_profiles WHERE email = ${email}
  `;
  if (existing.length > 0) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const rows = await sql`
    INSERT INTO user_profiles (email, display_name, password_hash, system_role, provider)
    VALUES (${email}, ${displayName}, ${passwordHash}, ${role}, 'email')
    RETURNING id
  `;

  return rows[0].id as string;
}

export async function deleteUser(userId: string) {
  const { userId: myId } = await requireAdmin();

  if (userId === myId) {
    throw new Error("Cannot delete yourself");
  }

  const sql = getDb();

  const target = await sql`
    SELECT system_role FROM user_profiles WHERE id = ${userId}
  `;
  if (target[0]?.system_role === "super_admin") {
    throw new Error("Cannot delete a super admin");
  }

  await sql`DELETE FROM projects WHERE user_id = ${userId}`;
  await sql`DELETE FROM user_profiles WHERE id = ${userId}`;
}
