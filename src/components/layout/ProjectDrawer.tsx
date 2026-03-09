"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/lib/projects/store";
import { useCADStore } from "@/lib/cad/store";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Trash2,
  Upload,
  File,
  FileImage,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isPdfFile = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

export function ProjectSidebar() {
  const router = useRouter();
  const {
    projects,
    currentProjectId,
    loadProjects,
    getCurrentProject,
    removeDrawing,
    renameProject,
    deleteProject,
  } = useProjectStore();
  const { openFileAsTab } = useCADStore();

  const [filesExpanded, setFilesExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const currentProject = getCurrentProject();

  const handleOpenFile = (drawingId: string) => {
    if (!currentProject) return;
    const drawing = currentProject.drawings.find((d) => d.id === drawingId);
    if (!drawing?.dxfContent) return;

    // Open as a working copy tab
    openFileAsTab(drawing.id, drawing.fileName, drawing.dxfContent);
  };

  const handleDeleteDrawing = async (e: React.MouseEvent, drawingId: string, name: string) => {
    e.stopPropagation();
    if (!currentProjectId) return;
    if (confirm(`Delete "${name}"?\n\nThis will permanently remove this source file. This cannot be undone.`)) {
      try {
        await removeDrawing(currentProjectId, drawingId);
      } catch (err) {
        console.error("Delete drawing failed:", err);
        alert("Failed to delete file. Please try again.");
      }
    }
  };

  const handleStartRename = () => {
    if (!currentProject) return;
    setRenameValue(currentProject.name);
    setIsRenamingProject(true);
  };

  const handleFinishRename = () => {
    if (currentProjectId && renameValue.trim()) {
      renameProject(currentProjectId, renameValue.trim());
    }
    setIsRenamingProject(false);
  };

  const handleDeleteProject = () => {
    if (!currentProject || !currentProjectId) return;
    if (
      confirm(
        `Delete project "${currentProject.name}"?\n\nAll files in this project will be permanently deleted. This cannot be undone.`
      )
    ) {
      deleteProject(currentProjectId);
      router.push("/");
    }
  };

  return (
    <div className="w-56 border-r border-[#E7E7E7] bg-[#F7F9FA] flex flex-col h-full">
      {/* Project name header with rename/delete */}
      <div className="px-3 py-3 border-b border-[#E7E7E7]">
        {isRenamingProject ? (
          <div className="flex items-center gap-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFinishRename();
                if (e.key === "Escape") setIsRenamingProject(false);
              }}
              className="h-7 text-sm font-semibold"
              autoFocus
            />
            <button
              onClick={handleFinishRename}
              className="p-1 rounded hover:bg-[#EDEDF0] text-[#93C90F]"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsRenamingProject(false)}
              className="p-1 rounded hover:bg-[#EDEDF0] text-[#999]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <div className="text-sm font-semibold text-[#222] truncate flex-1">
              {currentProject?.name || "No Project"}
            </div>
            <button
              onClick={handleStartRename}
              className="p-1 rounded hover:bg-[#EDEDF0] text-[#999] hover:text-[#555] opacity-0 group-hover:opacity-100 transition-opacity"
              title="Rename project"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={handleDeleteProject}
              className="p-1 rounded hover:bg-red-50 text-[#999] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete project"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Files section */}
      <div>
        <button
          className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#555] uppercase tracking-wider hover:bg-[#EDEDF0] transition-colors"
          onClick={() => setFilesExpanded(!filesExpanded)}
        >
          {filesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Source Files ({currentProject?.drawings.length || 0})
        </button>

        {filesExpanded && (
          <div className="px-1.5 pb-2">
            {currentProject?.drawings.map((drawing) => (
              <div
                key={drawing.id}
                className="flex items-center gap-2 px-2 py-2 rounded hover:bg-[#EDEDF0] cursor-pointer group transition-colors"
                onClick={() => handleOpenFile(drawing.id)}
                title={`Open "${drawing.fileName}" as a working copy`}
              >
                {isPdfFile(drawing.fileName) ? (
                  <FileImage className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                ) : (
                  <File className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[#333] truncate">{drawing.fileName}</div>
                  <div className="text-[10px] text-[#999]">
                    {formatFileSize(drawing.fileSizeBytes)} · {timeAgo(drawing.createdAt)}
                  </div>
                </div>
                <button
                  className="p-0.5 rounded hover:bg-white text-[#999] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteDrawing(e, drawing.id, drawing.fileName)}
                  title="Delete source file"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {(!currentProject || currentProject.drawings.length === 0) && (
              <div className="px-2 py-4 text-center text-xs text-[#999]">
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-[#bbb]" />
                No files yet.
                <br />
                Upload a DXF, DWG, or PDF.
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Other projects section */}
      <div>
        <button
          className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[#555] uppercase tracking-wider hover:bg-[#EDEDF0] transition-colors"
          onClick={() => setProjectsExpanded(!projectsExpanded)}
        >
          {projectsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Projects ({projects.length})
        </button>

        {projectsExpanded && (
          <ScrollArea className="max-h-48">
            <div className="px-1.5 pb-2">
              {projects.map((project) => {
                const isActive = project.id === currentProjectId;
                return (
                  <button
                    key={project.id}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-[#93C90F]/10 text-[#222] font-medium"
                        : "text-[#555] hover:bg-[#EDEDF0]"
                    }`}
                    onClick={() => {
                      if (!isActive) {
                        useProjectStore.getState().openProject(project.id);
                        window.location.reload();
                      }
                    }}
                  >
                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-[#93C90F]" : "text-[#999]"}`} />
                    <span className="truncate">{project.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
