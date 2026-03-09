import { createClient } from "@/lib/supabase/client";

const OLD_STORAGE_KEY = "energylink-flex-projects";
const MIGRATION_DONE_KEY = "energylink-flex-migrated";

interface OldProject {
  id: string;
  name: string;
  description: string;
  systemType: string;
  createdAt: string;
  updatedAt: string;
  drawings: OldDrawing[];
}

interface OldDrawing {
  id: string;
  name: string;
  fileName: string;
  dxfContent?: string;
  createdAt: string;
  updatedAt: string;
}

export async function migrateFromLocalStorage(): Promise<{
  migrated: number;
  skipped: boolean;
}> {
  if (typeof window === "undefined") return { migrated: 0, skipped: true };

  // Already migrated
  if (localStorage.getItem(MIGRATION_DONE_KEY)) {
    return { migrated: 0, skipped: true };
  }

  // Check for old data
  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return { migrated: 0, skipped: true };
  }

  let oldProjects: OldProject[];
  try {
    oldProjects = JSON.parse(raw);
  } catch {
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return { migrated: 0, skipped: true };
  }

  if (!oldProjects.length) {
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return { migrated: 0, skipped: true };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { migrated: 0, skipped: true };

  let migratedCount = 0;

  for (const oldProject of oldProjects) {
    try {
      // Insert project
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: oldProject.name,
          description: oldProject.description || "",
          system_type: oldProject.systemType || "scr-co-catalyst",
          created_at: oldProject.createdAt,
          updated_at: oldProject.updatedAt,
        })
        .select()
        .single();

      if (projectError) {
        console.error("Migration: failed to insert project", projectError);
        continue;
      }

      // Insert drawings
      for (const oldDrawing of oldProject.drawings) {
        const { error: drawingError } = await supabase
          .from("drawings")
          .insert({
            project_id: newProject.id,
            name: oldDrawing.name,
            file_name: oldDrawing.fileName,
            dxf_content: oldDrawing.dxfContent || null,
            created_at: oldDrawing.createdAt,
            updated_at: oldDrawing.updatedAt,
          });

        if (drawingError) {
          console.error("Migration: failed to insert drawing", drawingError);
        }
      }

      migratedCount++;
    } catch (err) {
      console.error("Migration: error migrating project", err);
    }
  }

  // Mark as done and clear old data
  localStorage.setItem(MIGRATION_DONE_KEY, "true");
  localStorage.removeItem(OLD_STORAGE_KEY);
  localStorage.removeItem("energylink-flex-current-project");

  return { migrated: migratedCount, skipped: false };
}
