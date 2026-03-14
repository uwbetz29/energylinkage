"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorStore } from "@/stores/editor-store";
import { TITAN_PGM130_COMPONENTS } from "./component-data";
import { DrawingCanvas } from "./drawing-canvas";
import { ComponentSidebar } from "./component-sidebar";
import { NLBar } from "./nl-bar";
import { StageNav } from "./stage-nav";
import Link from "next/link";
import { ArrowLeft, Undo2, Download, Loader2 } from "lucide-react";
import { getProject } from "@/app/projects/actions";

export function EditorShell() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const { changeCount, projectName, setComponents, setPdfUrl, setProject } =
    useEditorStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      // Demo mode: load static drawing
      setComponents(TITAN_PGM130_COMPONENTS);
      setPdfUrl("/drawings/24189-CS1-0001_0.pdf");
      setProject("demo", "TITAN PGM 130 — Demo Drawing");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProject() {
      try {
        setLoading(true);
        setError(null);

        const project = await getProject(projectId!);
        if (cancelled) return;

        setProject(project.id, project.name);

        if (project.pdf_url) {
          setPdfUrl(project.pdf_url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load project"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [projectId, setPdfUrl, setProject, setComponents]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#001030]">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
        <div className="text-white/30 text-sm mt-3">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#001030] gap-4">
        <div className="text-red-400 text-sm">{error}</div>
        <Link
          href="/"
          className="text-white/50 hover:text-white text-sm underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ─── Top Bar ─── */}
      <div
        className="h-[52px] flex items-center px-4 gap-3.5 flex-shrink-0 z-50 border-b border-white/[0.06]"
        style={{
          background:
            "linear-gradient(135deg, #001030 0%, #001a4d 50%, #002e81 100%)",
        }}
      >
        {/* Back button */}
        <Link
          href="/"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-2 text-white font-bold text-[14px] tracking-[0.3px] whitespace-nowrap">
          ENERGYLINK
          <span className="bg-gradient-to-br from-blue-400 to-blue-700 text-white px-1.5 py-0.5 rounded text-[11px] font-extrabold tracking-wider">
            FLEX
          </span>
        </div>
        <div className="w-px h-6 bg-white/12" />

        {/* Project name */}
        <div className="text-white/90 text-[13px] font-semibold flex-1 truncate">
          {projectName || "Untitled Project"}
        </div>

        {/* Stage navigation */}
        <StageNav />

        {/* Actions */}
        <div className="flex gap-1.5 items-center">
          <button className="px-3 py-1.5 rounded-[7px] text-[11px] font-semibold border border-white/15 bg-white/6 text-white/70 hover:bg-white/12 hover:text-white transition-all flex items-center gap-1.5">
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
          <button className="px-3 py-1.5 rounded-[7px] text-[11px] font-bold bg-white text-[#002e81] hover:bg-[#e6eeff] transition-all flex items-center gap-1.5">
            <Download className="w-3 h-3" />
            Export
            {changeCount > 0 && (
              <span className="bg-[#002e81] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {changeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex overflow-hidden">
        <DrawingCanvas />
        <ComponentSidebar />
      </div>

      {/* ─── NL Bar ─── */}
      <NLBar />
    </div>
  );
}
