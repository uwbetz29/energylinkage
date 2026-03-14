import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const sql = getDb();

  const rows = await sql`
    SELECT id FROM user_profiles
    WHERE reset_token = ${token}
      AND reset_token_expires > now()
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await sql`
    UPDATE user_profiles
    SET password_hash = ${passwordHash},
        reset_token = NULL,
        reset_token_expires = NULL,
        updated_at = now()
    WHERE id = ${rows[0].id as string}
  `;

  return NextResponse.json({ ok: true });
}
