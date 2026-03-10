"use server";

import { createClient } from "@/lib/supabase/server";

export interface Project {
  id: string;
  name: string;
  pdf_path: string | null;
  pdf_filename: string | null;
  created_at: string;
  updated_at: string;
}

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function createProject(name: string): Promise<{ id: string }> {
  const { supabase, user } = await requireAuth();

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, user_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function listProjects(): Promise<Project[]> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, pdf_path, pdf_filename, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getProject(projectId: string): Promise<Project> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, pdf_path, pdf_filename, created_at, updated_at")
    .eq("id", projectId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found");
  return data;
}

export async function getProjectPdfUrl(
  projectId: string
): Promise<string> {
  const { supabase } = await requireAuth();

  const { data: project, error } = await supabase
    .from("projects")
    .select("pdf_path")
    .eq("id", projectId)
    .single();

  if (error) throw new Error(error.message);
  if (!project?.pdf_path) throw new Error("No PDF uploaded for this project");

  const { data: signed, error: signError } = await supabase.storage
    .from("project-pdfs")
    .createSignedUrl(project.pdf_path, 3600);

  if (signError) throw new Error(signError.message);
  return signed.signedUrl;
}

export async function updateProjectPdf(
  projectId: string,
  pdfPath: string,
  pdfFilename: string
): Promise<void> {
  const { supabase } = await requireAuth();

  const { error } = await supabase
    .from("projects")
    .update({
      pdf_path: pdfPath,
      pdf_filename: pdfFilename,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
}
