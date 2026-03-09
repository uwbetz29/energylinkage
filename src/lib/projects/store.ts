import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectDrawing } from "./types";
import { mapProjectFromDB, mapDrawingFromDB } from "./types";

const CURRENT_PROJECT_KEY = "energylink-flex-current-project";

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  isLoaded: boolean;
  isSyncing: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  openProject: (id: string) => void;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addDrawing: (
    projectId: string,
    drawing: Pick<ProjectDrawing, "name" | "fileName" | "dxfContent" | "fileSizeBytes">
  ) => Promise<ProjectDrawing>;
  removeDrawing: (projectId: string, drawingId: string) => Promise<void>;
  updateDrawingContent: (drawingId: string, dxfContent: string) => Promise<void>;
  getCurrentProject: () => Project | null;
  closeProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoaded: false,
  isSyncing: false,

  loadProjects: async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ projects: [], isLoaded: true });
        return;
      }

      set({ isSyncing: true });

      const { data, error } = await supabase
        .from("projects")
        .select("*, drawings(*)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to load projects:", JSON.stringify(error, null, 2));
        set({ projects: [], isLoaded: true, isSyncing: false });
        return;
      }

      const projects = (data || []).map(mapProjectFromDB);
      const lastProjectId =
        typeof window !== "undefined"
          ? localStorage.getItem(CURRENT_PROJECT_KEY)
          : null;

      set({
        projects,
        isLoaded: true,
        isSyncing: false,
        currentProjectId: lastProjectId,
      });
    } catch (err) {
      console.error("Unexpected error loading projects:", err);
      set({ projects: [], isLoaded: true, isSyncing: false });
    }
  },

  createProject: async (name: string, description = "") => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) throw new Error("Not authenticated");
    const user = session.user;

    set({ isSyncing: true });

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name,
        description,
        system_type: "scr-co-catalyst",
      })
      .select("*, drawings(*)")
      .single();

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    const project = mapProjectFromDB(data);
    set((state) => ({
      projects: [project, ...state.projects],
      currentProjectId: project.id,
      isSyncing: false,
    }));

    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
    }

    return project;
  },

  openProject: (id: string) => {
    set({ currentProjectId: id });
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENT_PROJECT_KEY, id);
    }
  },

  deleteProject: async (id: string) => {
    const supabase = createClient();
    set({ isSyncing: true });

    // Soft delete
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    const { currentProjectId } = get();
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: currentProjectId === id ? null : currentProjectId,
      isSyncing: false,
    }));

    if (currentProjectId === id && typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  },

  renameProject: async (id: string, name: string) => {
    const supabase = createClient();
    set({ isSyncing: true });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("projects")
      .update({ name, updated_at: now })
      .eq("id", id);

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: now } : p
      ),
      isSyncing: false,
    }));
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    const supabase = createClient();
    set({ isSyncing: true });

    const now = new Date().toISOString();
    const dbUpdates: Record<string, unknown> = { updated_at: now };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description;
    if (updates.systemType !== undefined)
      dbUpdates.system_type = updates.systemType;
    if (updates.data !== undefined) dbUpdates.data = updates.data;

    const { error } = await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", id);

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: now } : p
      ),
      isSyncing: false,
    }));
  },

  addDrawing: async (projectId, drawingData) => {
    const supabase = createClient();
    set({ isSyncing: true });

    const { data, error } = await supabase
      .from("drawings")
      .insert({
        project_id: projectId,
        name: drawingData.name,
        file_name: drawingData.fileName,
        dxf_content: drawingData.dxfContent || null,
        file_size_bytes: drawingData.fileSizeBytes || null,
      })
      .select()
      .single();

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    const drawing = mapDrawingFromDB(data);

    // Update project's updated_at
    const now = new Date().toISOString();
    await supabase
      .from("projects")
      .update({ updated_at: now })
      .eq("id", projectId);

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, drawings: [...p.drawings, drawing], updatedAt: now }
          : p
      ),
      isSyncing: false,
    }));

    return drawing;
  },

  removeDrawing: async (projectId: string, drawingId: string) => {
    const supabase = createClient();
    set({ isSyncing: true });

    const { error } = await supabase
      .from("drawings")
      .delete()
      .eq("id", drawingId);

    if (error) {
      console.error("Failed to delete drawing:", error.message);
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    // Update local state immediately — don't block on project timestamp update
    const now = new Date().toISOString();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              drawings: p.drawings.filter((d) => d.id !== drawingId),
              updatedAt: now,
            }
          : p
      ),
      isSyncing: false,
    }));

    // Update project timestamp in background (non-blocking)
    supabase
      .from("projects")
      .update({ updated_at: now })
      .eq("id", projectId)
      .then(({ error: updateError }) => {
        if (updateError) console.error("Failed to update project timestamp:", updateError.message);
      });
  },

  updateDrawingContent: async (drawingId: string, dxfContent: string) => {
    const supabase = createClient();
    set({ isSyncing: true });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("drawings")
      .update({ dxf_content: dxfContent, updated_at: now })
      .eq("id", drawingId);

    if (error) {
      set({ isSyncing: false });
      throw new Error(error.message);
    }

    set((state) => ({
      projects: state.projects.map(p => ({
        ...p,
        drawings: p.drawings.map(d =>
          d.id === drawingId ? { ...d, dxfContent, updatedAt: now } : d
        ),
      })),
      isSyncing: false,
    }));
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get();
    return projects.find((p) => p.id === currentProjectId) || null;
  },

  closeProject: () => {
    set({ currentProjectId: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  },
}));
