"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listProjects, type Project } from "@/app/projects/actions";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";

interface OpenProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function OpenProjectDialog({ open, onClose }: OpenProjectDialogProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    listProjects()
      .then(setProjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load projects")
      )
      .finally(() => setLoading(false));
  }, [open]);

  const handleOpen = (projectId: string) => {
    onClose();
    router.push(`/editor?project=${projectId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Project</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="py-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#6b8ab8]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-8 h-8 mx-auto mb-3 text-[#ccc]" />
              <div className="text-sm font-medium text-[#888]">
                No projects yet
              </div>
              <div className="text-xs text-[#aaa] mt-1">
                Create a new project to get started
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpen(p.id)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-[rgba(0,46,129,0.06)]
                             transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#6b8ab8] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#001a4d] truncate">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-[#999] mt-0.5">
                        {p.pdf_filename || "No drawing uploaded"}
                        <span className="mx-1.5 opacity-40">·</span>
                        {formatDate(p.updated_at)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
