"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";

const MINIMAP_W = 200;

interface MinimapProps {
  mainCanvas: HTMLCanvasElement | null;
  wrapperEl: HTMLDivElement | null;
  canvasW: number;
  canvasH: number;
}

export function Minimap({ mainCanvas, wrapperEl, canvasW, canvasH }: MinimapProps) {
  const miniRef = useRef<HTMLCanvasElement>(null);
  const { zoom, panX, panY } = useEditorStore();

  const aspect = canvasH / canvasW || 0.65;
  const miniH = Math.round(MINIMAP_W * aspect);
  const dpr = 2; // retina

  /* ─── Compute viewport rectangle in minimap coords ─── */
  const getViewportRect = useCallback(() => {
    if (!wrapperEl || !canvasW || !canvasH) return null;
    const wrapW = wrapperEl.clientWidth;
    const wrapH = wrapperEl.clientHeight;

    // Visible area in canvas-pixel coords
    const visibleW = wrapW / zoom;
    const visibleH = wrapH / zoom;

    // Top-left of visible area in canvas coords
    // The canvas is centered, then offset by (panX, panY)
    const cx = canvasW / 2 - (wrapW / 2 + panX) / zoom;
    const cy = canvasH / 2 - (wrapH / 2 + panY) / zoom;

    // Scale to minimap CSS coords
    const s = MINIMAP_W / canvasW;
    return {
      x: cx * s,
      y: cy * s,
      w: visibleW * s,
      h: visibleH * s,
    };
  }, [wrapperEl, canvasW, canvasH, zoom, panX, panY]);

  /* ─── Paint minimap: thumbnail + viewport rect ─── */
  useEffect(() => {
    const mini = miniRef.current;
    if (!mini || !mainCanvas || !canvasW) return;
    const ctx = mini.getContext("2d");
    if (!ctx) return;

    mini.width = MINIMAP_W * dpr;
    mini.height = miniH * dpr;

    // White background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, mini.width, mini.height);

    // Draw scaled-down PDF
    ctx.drawImage(mainCanvas, 0, 0, mini.width, mini.height);

    // Viewport rectangle
    const rect = getViewportRect();
    if (rect) {
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clamp rect to minimap bounds
      const rx = Math.max(0, rect.x);
      const ry = Math.max(0, rect.y);
      const rw = Math.min(rect.w, MINIMAP_W - rx);
      const rh = Math.min(rect.h, miniH - ry);

      // Fill
      ctx.fillStyle = "rgba(0, 46, 129, 0.12)";
      ctx.fillRect(rx, ry, rw, rh);

      // Border
      ctx.strokeStyle = "#002e81";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.restore();
    }
  }, [mainCanvas, canvasW, canvasH, miniH, zoom, panX, panY, getViewportRect]);

  /* ─── Click to navigate ─── */
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasW || !canvasH) return;
      const mini = miniRef.current;
      if (!mini) return;
      const bounds = mini.getBoundingClientRect();

      // Click in minimap CSS coords
      const mx = e.clientX - bounds.left;
      const my = e.clientY - bounds.top;

      // Convert to canvas coords
      const s = MINIMAP_W / canvasW;
      const targetX = mx / s;
      const targetY = my / s;

      // Pan so this canvas point is centered
      const store = useEditorStore.getState();
      store.setPan(
        -(targetX - canvasW / 2) * zoom,
        -(targetY - canvasH / 2) * zoom
      );
    },
    [canvasW, canvasH, zoom]
  );

  if (!canvasW || !canvasH) return null;

  return (
    <div
      className="absolute bottom-14 left-3 z-20 rounded-lg overflow-hidden shadow-lg"
      style={{
        width: MINIMAP_W,
        height: miniH,
        border: "1.5px solid rgba(0,46,129,0.3)",
        background: "rgba(255,255,255,0.95)",
      }}
    >
      <canvas
        ref={miniRef}
        className="w-full h-full cursor-crosshair"
        style={{ display: "block" }}
        onClick={handleClick}
      />
    </div>
  );
}
