"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCADStore } from "@/lib/cad/store";
import { useProjectStore } from "@/lib/projects/store";
import {
  ArrowLeft,
  FileText,
  FileImage,
  Ruler,
  RotateCcw,
  Download,
  Loader2,
  Check,
  Cloud,
  CloudOff,
} from "lucide-react";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ViewerSidebar() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { drawing, dimensions, scaleHistory, undo, saveCurrentDrawing } = useCADStore();
  const activeTab = useCADStore((s) => s.getActiveTab());
  const undoStackLength = useCADStore((s) => s.undoStack.length);
  const { getCurrentProject } = useProjectStore();
  const project = getCurrentProject();

  // Auto-save: debounce 3 seconds after any change
  useEffect(() => {
    if (!activeTab?.isDirty || undoStackLength === 0) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveCurrentDrawing();
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 4000);
      }
    }, 3000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [undoStackLength, activeTab?.isDirty, saveCurrentDrawing]);

  // Find the current drawing in the project
  const currentDrawing = project?.drawings.find(
    (d) => d.id === activeTab?.sourceDrawingId
  );

  const handleExport = async () => {
    if (!drawing) return;
    setIsExporting(true);
    setExportError(null);

    try {
      // Serialize drawing entities for the export API
      const exportEntities = drawing.entities.map((e) => ({
        handle: e.handle,
        type: e.type,
        layer: e.layer,
        colorHex: e.color != null ? dxfColorToHex(e.color) : "#000000",
        lineWidth: 0.5,
        ...(e.vertices && { vertices: e.vertices }),
        ...(e.center && { center: e.center }),
        ...(e.radius != null && { radius: e.radius }),
        ...(e.text && { text: e.text }),
        ...(e.insertionPoint && { insertionPoint: e.insertionPoint }),
        ...(e.textHeight != null && { textHeight: e.textHeight }),
        ...(e.closed != null && { closed: e.closed }),
        ...(e.startAngle != null && { startAngle: e.startAngle }),
        ...(e.endAngle != null && { endAngle: e.endAngle }),
      }));

      const exportData = {
        entities: exportEntities,
        bounds: drawing.bounds,
        pages: [
          {
            width: drawing.bounds.max.x - drawing.bounds.min.x,
            height: drawing.bounds.max.y - drawing.bounds.min.y,
          },
        ],
        metadata: {
          title: activeTab?.label || drawing.fileName,
          author: "EnergyLink FLEX",
          creator: "EnergyLink FLEX v0.1.0",
          subject: project?.name || "",
        },
      };

      const blob = new Blob([JSON.stringify(exportData)], {
        type: "application/json",
      });
      const formData = new FormData();
      formData.append("file", blob, "export.json");

      const res = await fetch("/api/export-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Export failed");
      }

      // Download the PDF
      const pdfBlob = await res.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab?.label || "export"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setIsExporting(false);
    }
  };

  const changesCount = scaleHistory.length;
  const dimCount = dimensions.length;
  const highConfCount = dimensions.filter((d) => d.confidence >= 0.3).length;

  return (
    <div className="w-56 border-r border-[#D4D4D4] bg-[#FAFAFA] flex flex-col h-full">
      {/* Back link */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-[#666] hover:text-[#0C121D] hover:bg-[#EBEBEB] transition-colors border-b border-[#D4D4D4]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Projects
      </button>

      {/* File info */}
      <div className="px-3 py-3 border-b border-[#D4D4D4]">
        <div className="flex items-center gap-2 mb-2">
          {activeTab?.isPdf ? (
            <FileImage className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-[#999] flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-[#0C121D] truncate">
            {activeTab?.label || "No file"}
          </span>
        </div>
        <div className="space-y-1 text-[11px] text-[#999]">
          <div className="flex justify-between">
            <span>Original</span>
            <span className="text-[#666] truncate ml-2 max-w-[100px]">
              {currentDrawing?.fileName || activeTab?.fileName || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Size</span>
            <span className="text-[#666]">
              {formatFileSize(currentDrawing?.fileSizeBytes ?? null)}
            </span>
          </div>
          {drawing && (
            <div className="flex justify-between">
              <span>Entities</span>
              <span className="text-[#666]">{drawing.entities.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dimensions summary */}
      <div className="px-3 py-3 border-b border-[#D4D4D4]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Ruler className="w-3.5 h-3.5 text-[#93C90F]" />
          <span className="text-xs font-semibold text-[#666]">
            Dimensions
          </span>
        </div>
        {dimCount > 0 ? (
          <div className="text-[11px] text-[#999]">
            <span className="text-[#0C121D] font-medium">{dimCount}</span> detected
            {highConfCount < dimCount && (
              <span className="ml-1">
                ({highConfCount} high confidence)
              </span>
            )}
            <p className="mt-1 text-[10px] text-[#999]">
              Click dimensions on the canvas to edit
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[#999]">
            {drawing ? "No dimensions detected" : "Load a file to detect dimensions"}
          </p>
        )}
      </div>

      {/* Changes */}
      {changesCount > 0 && (
        <div className="px-3 py-3 border-b border-[#D4D4D4]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#666]">
              <span className="font-semibold text-[#0C121D]">{changesCount}</span>{" "}
              {changesCount === 1 ? "change" : "changes"} made
            </span>
            <button
              onClick={undo}
              className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#0C121D] transition-colors"
              title="Undo last change"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status & Export */}
      <div className="px-3 py-3 border-t border-[#D4D4D4] space-y-2">
        {/* Auto-save status indicator */}
        {drawing && (
          <div className="flex items-center gap-1.5 text-[11px]">
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-3 h-3 text-[#999] animate-spin" />
                <span className="text-[#999]">Saving...</span>
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Check className="w-3 h-3 text-[#93C90F]" />
                <span className="text-[#93C90F]">All changes saved</span>
              </>
            ) : saveStatus === "error" ? (
              <>
                <CloudOff className="w-3 h-3 text-red-500" />
                <span className="text-red-500">Save failed</span>
              </>
            ) : activeTab?.isDirty ? (
              <>
                <Cloud className="w-3 h-3 text-[#999]" />
                <span className="text-[#999]">Unsaved changes</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-[#D4D4D4]" />
                <span className="text-[#D4D4D4]">Up to date</span>
              </>
            )}
          </div>
        )}
        {exportError && (
          <p className="text-[10px] text-red-500 leading-tight">
            {exportError}
          </p>
        )}
        <button
          onClick={handleExport}
          disabled={!drawing || isExporting}
          className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-colors ${
            !drawing || isExporting
              ? "bg-[#D4D4D4] text-[#999] cursor-not-allowed"
              : "bg-[#93C90F] hover:bg-[#7AB00D] text-white shadow-sm"
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export to PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Convert a DXF color index to hex. Covers common ACI colors. */
function dxfColorToHex(color: number): string {
  const map: Record<number, string> = {
    0: "#000000",
    1: "#FF0000",
    2: "#FFFF00",
    3: "#00FF00",
    4: "#00FFFF",
    5: "#0000FF",
    6: "#FF00FF",
    7: "#000000",
    8: "#808080",
    9: "#C0C0C0",
  };
  return map[color] ?? "#000000";
}
