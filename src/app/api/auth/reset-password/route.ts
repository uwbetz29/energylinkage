import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const sql = getDb();

  // Check if user exists
  const rows = await sql`
    SELECT id FROM user_profiles WHERE email = ${email} AND provider = 'email'
  `;

  if (rows.length === 0) {
    // Don't reveal whether email exists
    return NextResponse.json({ ok: true });
  }

  // Generate token and save
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await sql`
    UPDATE user_profiles
    SET reset_token = ${token}, reset_token_expires = ${expires.toISOString()}, updated_at = now()
    WHERE id = ${rows[0].id as string}
  `;

  // In production, send an email here. For now, log the token.
  console.log(`[Password Reset] Token for ${email}: ${token}`);
  console.log(`[Password Reset] Link: ${process.env.NEXTAUTH_URL}/auth/update-password?token=${token}`);

  return NextResponse.json({ ok: true });
}
