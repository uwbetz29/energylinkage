"use client";

import { useRef, useCallback } from "react";
import { useCADStore } from "@/lib/cad/store";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Layers,
  MousePointer,
} from "lucide-react";

interface ToolbarProps {
  onToggleLayers?: () => void;
  showLayers?: boolean;
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors
        ${active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}
        ${disabled ? "opacity-40 pointer-events-none" : ""}
      `}
    >
      {children}
    </button>
  );
}

export function Toolbar({ onToggleLayers, showLayers }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { drawing, isLoading, loadDXFFile, undo, scaleHistory } =
    useCADStore();

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        loadDXFFile(content, file.name);
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [loadDXFFile]
  );

  const handleExportDXF = useCallback(() => {
    alert("DXF export coming soon!");
  }, []);

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf"
        className="hidden"
        onChange={handleFileUpload}
      />

      <ToolbarButton
        title="Upload DXF File"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
      >
        <Upload className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        title="Export DXF"
        onClick={handleExportDXF}
        disabled={!drawing}
      >
        <Download className="w-4 h-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton title="Zoom In" disabled={!drawing}>
        <ZoomIn className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton title="Zoom Out" disabled={!drawing}>
        <ZoomOut className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton title="Fit to View" disabled={!drawing}>
        <Maximize className="w-4 h-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton title="Select Component" disabled={!drawing}>
        <MousePointer className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        title="Toggle Layers Panel"
        onClick={onToggleLayers}
        disabled={!drawing}
        active={showLayers}
      >
        <Layers className="w-4 h-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolbarButton
        title="Undo Last Scale"
        onClick={undo}
        disabled={scaleHistory.length === 0}
      >
        <RotateCcw className="w-4 h-4" />
      </ToolbarButton>

      {/* Status */}
      <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
        {isLoading && <span>Loading...</span>}
        {drawing && (
          <>
            <span>{drawing.fileName}</span>
            <span className="text-zinc-600">|</span>
            <span>{drawing.entities.length} entities</span>
            <span className="text-zinc-600">|</span>
            <span>{drawing.components.length} components</span>
            <span className="text-zinc-600">|</span>
            <span>{drawing.layers.length} layers</span>
          </>
        )}
      </div>
    </div>
  );
}
