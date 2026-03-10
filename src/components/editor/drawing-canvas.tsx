"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Minimap } from "./minimap";

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0 });

  const {
    pdfUrl,
    currentSheet,
    components,
    selectedId,
    showOverlays,
    zoom,
    panX,
    panY,
    select,
    setZoom,
    setPan,
  } = useEditorStore();

  /* ─── Load PDF ─── */
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;

    async function load() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      const doc = await pdfjsLib.getDocument(pdfUrl!).promise;
      if (cancelled) return;
      pdfDocRef.current = doc;
      renderPage(doc, currentSheet);
    }
    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  /* ─── Re-render on sheet change ─── */
  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentSheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSheet]);

  async function renderPage(doc: any, pageNum: number) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    setCanvasSize({ w: viewport.width, h: viewport.height });
  }

  /* ─── Auto zoom-fit when canvas size changes ─── */
  useEffect(() => {
    if (!canvasSize.w || !canvasSize.h) return;
    const wrap = wrapRef.current;
    if (!wrap || !wrap.clientWidth) return;
    const sx = (wrap.clientWidth - 40) / canvasSize.w;
    const sy = (wrap.clientHeight - 40) / canvasSize.h;
    const store = useEditorStore.getState();
    store.setZoom(Math.min(sx, sy));
    store.setPan(0, 0);
  }, [canvasSize]);

  /* ─── Zoom helpers ─── */
  const zoomFit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const c = canvasRef.current;
    if (!c || !c.width || !c.height) return;
    const sx = (wrap.clientWidth - 40) / c.width;
    const sy = (wrap.clientHeight - 40) / c.height;
    setZoom(Math.min(sx, sy));
    setPan(0, 0);
  }, [setZoom, setPan]);

  /* ─── Mouse wheel zoom ─── */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom(useEditorStore.getState().zoom * factor);
    };
    wrap.addEventListener("wheel", handler, { passive: false });
    return () => wrap.removeEventListener("wheel", handler);
  }, [setZoom]);

  /* ─── Pan with drag ─── */
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-comp-overlay]")) return;
    dragRef.current = {
      dragging: true,
      startX: e.clientX - panX,
      startY: e.clientY - panY,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPan(
        e.clientX - dragRef.current.startX,
        e.clientY - dragRef.current.startY
      );
    };
    const onUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setPan]);

  const transform = `translate(${panX}px, ${panY}px) translate(-50%, -50%) scale(${zoom})`;
  const { w, h } = canvasSize;

  return (
    <div
      ref={wrapRef}
      className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ background: "#e8ecf0" }}
      onMouseDown={onMouseDown}
    >
      {/* PDF canvas */}
      <canvas
        ref={canvasRef}
        id="pdf-canvas"
        className="absolute top-1/2 left-1/2"
        style={{
          transform,
          transformOrigin: "center center",
          background: "#fff",
          boxShadow: "0 2px 20px rgba(0,0,0,0.15)",
        }}
      />

      {/* Component overlays */}
      {w > 0 && (
        <div
          className="absolute top-1/2 left-1/2 pointer-events-none"
          style={{
            transform,
            transformOrigin: "center center",
            width: w,
            height: h,
          }}
        >
          {Object.values(components).map((comp) => {
            const isSelected = comp.id === selectedId;
            const showBorder = showOverlays || isSelected;
            return (
              <div
                key={comp.id}
                data-comp-overlay
                className="absolute pointer-events-auto cursor-pointer transition-all duration-200 rounded-[4px] group"
                style={{
                  left: `${comp.box[0]}%`,
                  top: `${comp.box[1]}%`,
                  width: `${comp.box[2]}%`,
                  height: `${comp.box[3]}%`,
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: showBorder
                    ? comp.color
                    : "transparent",
                  background: isSelected
                    ? `${comp.color}18`
                    : showOverlays
                      ? `${comp.color}08`
                      : "transparent",
                  boxShadow: isSelected
                    ? `0 0 0 3px ${comp.color}30`
                    : "none",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  select(comp.id);
                }}
              >
                <span
                  className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded
                             text-white whitespace-nowrap uppercase tracking-wide
                             opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    background: comp.color,
                    opacity:
                      showOverlays || isSelected ? 0.9 : undefined,
                  }}
                >
                  {comp.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {!pdfUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="text-white/30 text-4xl">📄</div>
          <div className="text-white/40 text-sm font-medium">
            No drawing loaded
          </div>
        </div>
      )}

      {/* Floating controls */}
      <div className="absolute top-3 left-3 flex gap-1 z-10">
        {[
          { label: "+", action: () => setZoom(useEditorStore.getState().zoom * 1.25) },
          { label: "−", action: () => setZoom(useEditorStore.getState().zoom * 0.8) },
          { label: "⇲", action: zoomFit },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className="w-[34px] h-[34px] rounded-[9px] bg-[rgba(20,30,50,0.85)]
                       border border-white/10 text-white/60 flex items-center justify-center
                       text-[15px] hover:bg-[rgba(30,50,80,0.9)] hover:text-white
                       hover:border-white/20 transition-all backdrop-blur-sm"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Mode toggles */}
      <div className="absolute top-3 right-[352px] flex gap-1 z-10">
        <button
          onClick={() => useEditorStore.getState().toggleOverlays()}
          className={`px-2.5 py-1.5 rounded-[9px] text-[11px] font-semibold flex items-center gap-1.5
                      backdrop-blur-sm border transition-all ${
                        showOverlays
                          ? "bg-[rgba(0,46,129,0.7)] text-white border-[#1a5cb8]"
                          : "bg-[rgba(20,30,50,0.85)] border-white/10 text-white/50 hover:text-white/80"
                      }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: showOverlays ? "#fff" : "currentColor",
              opacity: showOverlays ? 1 : 0.4,
            }}
          />
          Components
        </button>
      </div>

      {/* Minimap */}
      <Minimap
        mainCanvas={canvasRef.current}
        wrapperEl={wrapRef.current}
        canvasW={w}
        canvasH={h}
      />

      {/* Sheet tabs */}
      <div className="absolute bottom-3 left-3 flex gap-1 z-10">
        {[
          { n: 1, label: "Sheet 1 — Notes" },
          { n: 2, label: "Sheet 2 — Elevation" },
          { n: 3, label: "Sheet 3 — Section" },
        ].map((s) => (
          <button
            key={s.n}
            onClick={() => useEditorStore.getState().setSheet(s.n)}
            className={`px-3 py-1.5 rounded-[7px] text-[11px] font-semibold backdrop-blur-sm
                        border transition-all ${
                          currentSheet === s.n
                            ? "bg-[rgba(0,46,129,0.6)] text-white border-[#1a5cb8]"
                            : "bg-[rgba(20,30,50,0.85)] border-white/10 text-white/40 hover:text-white/70"
                        }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-[352px] px-2.5 py-1.5 rounded-[7px]
                       bg-[rgba(20,30,50,0.85)] border border-white/8 text-white/40
                       text-[11px] font-semibold backdrop-blur-sm z-10">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
