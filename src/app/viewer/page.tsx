"use client";

import { useState } from "react";
import { CADCanvas } from "@/components/cad-viewer/CADCanvas";
import { ComponentPanel } from "@/components/cad-viewer/ComponentPanel";
import { Toolbar } from "@/components/cad-viewer/Toolbar";
import { LayerPanel } from "@/components/cad-viewer/LayerPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ViewerPage() {
  const [showLayers, setShowLayers] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
        {/* Toolbar */}
        <Toolbar
          onToggleLayers={() => setShowLayers(!showLayers)}
          showLayers={showLayers}
        />

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* CAD Canvas — takes remaining space */}
          <div className="flex-1 relative">
            <CADCanvas />
          </div>

          {/* Layer panel (optional) */}
          {showLayers && <LayerPanel />}

          {/* Component/Scale panel — right sidebar */}
          <div className="w-72 border-l border-zinc-800 bg-zinc-900/50">
            <ScrollArea className="h-full">
              <ComponentPanel />
            </ScrollArea>
          </div>
        </div>

        {/* Status bar */}
        <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center px-3 text-[10px] text-zinc-600">
          <span>EnergyLinkage v0.1.0</span>
          <span className="mx-2">|</span>
          <span>Shift+Click to pan, Scroll to zoom</span>
        </div>
    </div>
  );
}
