import { createClient } from "@/lib/supabase/client";

export async function uploadDrawingFile(
  userId: string,
  projectId: string,
  fileName: string,
  content: string | Blob
): Promise<{ path: string; size: number }> {
  const supabase = createClient();
  const path = `${userId}/${projectId}/${Date.now()}-${fileName}`;

  const blob =
    typeof content === "string"
      ? new Blob([content], { type: "text/plain" })
      : content;

  const { data, error } = await supabase.storage
    .from("drawings")
    .upload(path, blob, { upsert: true });

  if (error) throw error;
  return { path: data.path, size: blob.size };
}

export async function downloadDrawingFile(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("drawings")
    .download(path);

  if (error) throw error;
  return await data.text();
}

export async function deleteDrawingFile(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("drawings")
    .remove([path]);

  if (error) throw error;
}
