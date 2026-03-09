"use client";

import { useCADStore } from "@/lib/cad/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, EyeIcon, EyeOffIcon } from "lucide-react";

export function LayerPanel() {
  const { drawing, layerVisibility, toggleLayerVisibility, setAllLayerVisibility } = useCADStore();

  if (!drawing) return null;

  const sortedLayers = [...drawing.layers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const visibleCount = sortedLayers.filter(l => layerVisibility[l.name] !== false).length;
  const allVisible = visibleCount === sortedLayers.length;
  const allHidden = visibleCount === 0;

  return (
    <div className="w-56 border-l border-[#E7E7E7] bg-[#F7F9FA]">
      <div className="p-3 border-b border-[#E7E7E7] flex items-center justify-between">
        <h3 className="text-xs font-medium text-[#555]">
          Layers ({visibleCount}/{sortedLayers.length})
        </h3>
        <div className="flex items-center gap-1">
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${allVisible ? "text-[#bbb]" : "text-[#555] hover:bg-[#E7E7E7]"}`}
            onClick={() => setAllLayerVisibility(true)}
            disabled={allVisible}
            title="Show All Layers"
          >
            <EyeIcon className="w-3 h-3" />
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${allHidden ? "text-[#bbb]" : "text-[#555] hover:bg-[#E7E7E7]"}`}
            onClick={() => setAllLayerVisibility(false)}
            disabled={allHidden}
            title="Hide All Layers"
          >
            <EyeOffIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
      <ScrollArea className="h-full">
        <div className="p-2 space-y-0.5">
          {sortedLayers.map((layer) => {
            const isVisible = layerVisibility[layer.name] !== false;
            return (
              <button
                key={layer.name}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-[#EDEDF0] transition-colors"
                onClick={() => toggleLayerVisibility(layer.name)}
              >
                {isVisible ? (
                  <Eye className="w-3 h-3 text-[#555]" />
                ) : (
                  <EyeOff className="w-3 h-3 text-[#bbb]" />
                )}
                <span
                  className={
                    isVisible ? "text-[#333]" : "text-[#bbb] line-through"
                  }
                >
                  {layer.name}
                </span>
                <span className="ml-auto text-[#999]">
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
