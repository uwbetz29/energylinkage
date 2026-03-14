"use server";

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { put, del } from "@vercel/blob";

export interface Project {
  id: string;
  name: string;
  pdf_url: string | null;
  pdf_filename: string | null;
  created_at: string;
  updated_at: string;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

export async function createProject(name: string): Promise<{ id: string }> {
  const user = await requireAuth();
  const sql = getDb();

  const rows = await sql`
    INSERT INTO projects (user_id, name)
    VALUES (${user.id}, ${name})
    RETURNING id
  `;

  return { id: rows[0].id as string };
}

export async function listProjects(): Promise<Project[]> {
  const user = await requireAuth();
  const sql = getDb();

  const rows = await sql`
    SELECT id, name, pdf_url, pdf_filename, created_at, updated_at
    FROM projects
    WHERE user_id = ${user.id}
    ORDER BY updated_at DESC
  `;

  return rows as unknown as Project[];
}

export async function getProject(projectId: string): Promise<Project> {
  const user = await requireAuth();
  const sql = getDb();

  const rows = await sql`
    SELECT id, name, pdf_url, pdf_filename, created_at, updated_at
    FROM projects
    WHERE id = ${projectId} AND user_id = ${user.id}
  `;

  if (rows.length === 0) throw new Error("Project not found");
  return rows[0] as unknown as Project;
}

export async function getProjectPdfUrl(projectId: string): Promise<string> {
  const user = await requireAuth();
  const sql = getDb();

  const rows = await sql`
    SELECT pdf_url FROM projects
    WHERE id = ${projectId} AND user_id = ${user.id}
  `;

  if (rows.length === 0) throw new Error("Project not found");
  if (!rows[0].pdf_url) throw new Error("No PDF uploaded for this project");

  return rows[0].pdf_url as string;
}

export async function uploadProjectPdf(
  projectId: string,
  formData: FormData
): Promise<{ url: string }> {
  const user = await requireAuth();
  const sql = getDb();

  // Verify project ownership
  const rows = await sql`
    SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${user.id}
  `;
  if (rows.length === 0) throw new Error("Project not found");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  // Upload to Vercel Blob
  const blob = await put(`projects/${user.id}/${projectId}/${file.name}`, file, {
    access: "public",
  });

  // Update project row
  await sql`
    UPDATE projects
    SET pdf_url = ${blob.url}, pdf_filename = ${file.name}, updated_at = now()
    WHERE id = ${projectId}
  `;

  return { url: blob.url };
}

export async function deleteProjectPdf(projectId: string): Promise<void> {
  const user = await requireAuth();
  const sql = getDb();

  const rows = await sql`
    SELECT pdf_url FROM projects WHERE id = ${projectId} AND user_id = ${user.id}
  `;
  if (rows.length === 0) throw new Error("Project not found");

  if (rows[0].pdf_url) {
    await del(rows[0].pdf_url as string);
  }

  await sql`
    UPDATE projects SET pdf_url = NULL, pdf_filename = NULL, updated_at = now()
    WHERE id = ${projectId}
  `;
}
