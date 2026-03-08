"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/lib/projects/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  FolderOpen,
  Trash2,
  Pencil,
  Clock,
  FileText,
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function StartPage() {
  const router = useRouter();
  const {
    projects,
    isLoaded,
    loadFromStorage,
    createProject,
    openProject,
    deleteProject,
    renameProject,
  } = useProjectStore();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const project = createProject(newProjectName.trim());
    setShowNewDialog(false);
    setNewProjectName("");
    openProject(project.id);
    router.push("/viewer");
  };

  const handleOpenProject = (id: string) => {
    openProject(id);
    setShowOpenDialog(false);
    router.push("/viewer");
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteProject(id);
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleFinishRename = () => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F0F7E6]">
        <div className="animate-pulse text-[#888]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EDF5E0] via-[#F0F7E6] to-[#E8F0DB] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-end px-6 py-4">
        <span className="text-sm text-[#888]">EnergyLink FLEX v0.1.0</span>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center pb-20">
        {/* Logo */}
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          <span className="text-[#222]">Energy</span>
          <span className="text-[#222]">Link</span>{" "}
          <span className="text-[#93C90F]">FLEX</span>
        </h1>

        {/* Greeting */}
        <p className="text-xl text-[#555] mb-12">
          {getGreeting()} — what are we working on?
        </p>

        {/* Action Cards */}
        <div className="flex gap-6">
          {/* New Project Card */}
          <button
            onClick={() => setShowNewDialog(true)}
            className="w-[280px] h-[200px] bg-white/80 backdrop-blur-sm rounded-2xl border border-[#D4E4B8] hover:border-[#93C90F] hover:shadow-lg hover:shadow-[#93C90F]/10 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-[#93C90F]/10 flex items-center justify-center group-hover:bg-[#93C90F]/20 transition-colors">
              <Plus className="w-6 h-6 text-[#93C90F]" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-[#222] text-lg">New Project</div>
              <div className="text-sm text-[#888] mt-1">Start a fresh project from scratch</div>
            </div>
          </button>

          {/* Open Project Card */}
          <button
            onClick={() => {
              if (projects.length === 0) {
                setShowNewDialog(true);
              } else {
                setShowOpenDialog(true);
              }
            }}
            className="w-[280px] h-[200px] bg-white/80 backdrop-blur-sm rounded-2xl border border-[#D4E4B8] hover:border-[#93C90F] hover:shadow-lg hover:shadow-[#93C90F]/10 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-[#93C90F]/10 flex items-center justify-center group-hover:bg-[#93C90F]/20 transition-colors">
              <FolderOpen className="w-6 h-6 text-[#93C90F]" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-[#222] text-lg">Open Project</div>
              <div className="text-sm text-[#888] mt-1">Continue where you left off</div>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-[#aaa]">
        <span>EnergyLink International</span>
        <span className="mx-2">|</span>
        <span>EnergyLink FLEX v0.1.0</span>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-[#555] mb-1 block">
                Project Name
              </label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Independence Station SCR System"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="bg-[#93C90F] hover:bg-[#86BB46] text-white"
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Project Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open Project</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[400px] overflow-y-auto">
            {sortedProjects.length === 0 ? (
              <p className="text-center text-[#888] py-8">
                No projects yet. Create one to get started.
              </p>
            ) : (
              <div className="grid gap-2">
                {sortedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[#E7E7E7] hover:border-[#93C90F]/40 hover:bg-[#93C90F]/5 transition-all cursor-pointer group"
                    onClick={() => handleOpenProject(project.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-[#F0F0F0] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#93C90F]/10">
                        <FileText className="w-4 h-4 text-[#888] group-hover:text-[#93C90F]" />
                      </div>
                      <div className="min-w-0">
                        {renamingId === project.id ? (
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleFinishRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleFinishRename();
                              if (e.key === "Escape") {
                                setRenamingId(null);
                                setRenameValue("");
                              }
                            }}
                            className="h-7 text-sm font-medium"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h3 className="font-medium text-[#222] truncate text-sm">
                            {project.name}
                          </h3>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[#999] mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(project.updatedAt)}
                          </span>
                          <span>
                            {project.drawings.length} drawing
                            {project.drawings.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 rounded hover:bg-[#F0F0F0] text-[#888] hover:text-[#555]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(project.id, project.name);
                        }}
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-[#888] hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id, project.name);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
