"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/lib/projects/store";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave(projectId: string | null, debounceMs = 2000) {
  const { updateProject, getCurrentProject } = useProjectStore();
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (!projectId) return;
    const project = getCurrentProject();
    if (!project) return;

    setStatus("saving");
    try {
      await updateProject(projectId, { data: project.data });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [projectId, updateProject, getCurrentProject]);

  const debouncedSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, debounceMs);
  }, [save, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { save, debouncedSave, status };
}
