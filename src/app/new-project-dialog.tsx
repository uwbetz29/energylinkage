"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject, uploadProjectPdf } from "@/app/projects/actions";
import { Upload } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (!file) {
      setError("Please select a PDF drawing");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File must be under 50 MB");
      return;
    }

    try {
      setLoading(true);

      // 1. Create project row
      setProgress("Creating project...");
      const { id: projectId } = await createProject(name.trim());

      // 2. Upload PDF via server action
      setProgress("Uploading drawing...");
      const formData = new FormData();
      formData.append("file", file);
      await uploadProjectPdf(projectId, formData);

      // 3. Navigate to editor
      setProgress("Opening editor...");
      onCreated(projectId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName("");
    setFile(null);
    setError("");
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-[#555] mb-1 block">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Carter Machinery — Independence #1"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#555] mb-1 block">
              Drawing PDF
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
                ${file ? "border-[#002e81]/40 bg-[#002e81]/5" : "border-[#ddd] hover:border-[#002e81]/30 hover:bg-[#002e81]/3"}`}
              onClick={() => !loading && fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
              />
              <Upload className="w-6 h-6 mx-auto mb-2 text-[#6b8ab8]" />
              {file ? (
                <div>
                  <div className="text-sm font-semibold text-[#001a4d]">
                    {file.name}
                  </div>
                  <div className="text-xs text-[#6b8ab8] mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-[#666]">
                    Click to select PDF
                  </div>
                  <div className="text-xs text-[#999] mt-0.5">
                    Max 50 MB
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#002e81] hover:bg-[#0a3d99] text-white"
            >
              {loading ? progress || "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
