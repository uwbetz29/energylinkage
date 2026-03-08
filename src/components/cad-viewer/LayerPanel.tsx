"use client";

import { useCADStore } from "@/lib/cad/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff } from "lucide-react";

export function LayerPanel() {
  const { drawing, layerVisibility, toggleLayerVisibility } = useCADStore();

  if (!drawing) return null;

  const sortedLayers = [...drawing.layers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="w-56 border-l border-zinc-800 bg-zinc-900/50">
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-xs font-medium text-zinc-400">
          Layers ({sortedLayers.length})
        </h3>
      </div>
      <ScrollArea className="h-full">
        <div className="p-2 space-y-0.5">
          {sortedLayers.map((layer) => {
            const isVisible = layerVisibility[layer.name] !== false;
            return (
              <button
                key={layer.name}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-zinc-800 transition-colors"
                onClick={() => toggleLayerVisibility(layer.name)}
              >
                {isVisible ? (
                  <Eye className="w-3 h-3 text-zinc-400" />
                ) : (
                  <EyeOff className="w-3 h-3 text-zinc-600" />
                )}
                <span
                  className={
                    isVisible ? "text-zinc-300" : "text-zinc-600 line-through"
                  }
                >
                  {layer.name}
                </span>
                <span className="ml-auto text-zinc-600">
                  {layer.entityCount}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
