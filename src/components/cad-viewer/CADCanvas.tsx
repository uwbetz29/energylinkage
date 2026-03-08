"use client";

import { useEffect, useRef, useCallback } from "react";
import { CADRenderer } from "@/lib/cad/renderer";
import { useCADStore } from "@/lib/cad/store";

export function CADCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CADRenderer | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const {
    drawing,
    selectedComponentId,
    hoveredComponentId,
    selectComponent,
    hoverComponent,
  } = useCADStore();

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new CADRenderer();
    renderer.mount(containerRef.current);
    rendererRef.current = renderer;

    // Set up minimap updates on view change
    renderer.onViewChange(() => {
      if (minimapRef.current) {
        renderer.renderMinimap(minimapRef.current);
      }
    });

    return () => {
      renderer.unmount();
      rendererRef.current = null;
    };
  }, []);

  // Load drawing when it changes
  useEffect(() => {
    if (!rendererRef.current || !drawing) return;
    rendererRef.current.loadDrawing(drawing);
    // Render initial minimap
    if (minimapRef.current) {
      rendererRef.current.renderMinimap(minimapRef.current);
    }
  }, [drawing]);

  // Update highlights
  useEffect(() => {
    if (!rendererRef.current) return;
    if (selectedComponentId) {
      rendererRef.current.highlightComponent(selectedComponentId, "#FFD700");
    } else if (hoveredComponentId) {
      rendererRef.current.highlightComponent(hoveredComponentId, "#4A90D9");
    } else {
      rendererRef.current.highlightComponent(null);
    }
  }, [selectedComponentId, hoveredComponentId]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!rendererRef.current || !drawing) return;
      // If user just finished dragging, don't select
      if (rendererRef.current.didPan()) return;

      const componentId = rendererRef.current.getComponentAtPoint(
        event.clientX,
        event.clientY
      );
      selectComponent(componentId);
    },
    [drawing, selectComponent]
  );

  const handleMinimapClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!rendererRef.current || !minimapRef.current || !drawing) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * minimapRef.current.width;
      const y = ((event.clientY - rect.top) / rect.height) * minimapRef.current.height;
      const world = rendererRef.current.minimapToWorld(x, y, minimapRef.current);
      rendererRef.current.panTo(world.x, world.y);
    },
    [drawing]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing"
      onClick={handleClick}
    >
      {!drawing && (
        <div className="absolute inset-0 flex items-center justify-center text-[#888]">
          <div className="text-center">
            <p className="text-lg font-medium text-[#555]">No drawing loaded</p>
            <p className="text-sm mt-1">Upload a DXF or DWG file to get started</p>
          </div>
        </div>
      )}

      {/* Minimap */}
      {drawing && (
        <div className="absolute bottom-3 left-3 z-10">
          <canvas
            ref={minimapRef}
            width={200}
            height={150}
            className="rounded-lg border border-[#D4D4D4] shadow-md bg-white cursor-pointer"
            onClick={handleMinimapClick}
          />
        </div>
      )}
    </div>
  );
}
