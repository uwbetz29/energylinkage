import { useCADStore } from "./store";
import { parseDXF } from "./dxf-parse";
import { detectComponents } from "./component-detector";
import { linkDimensions } from "./dimension-link";
import type { ParsedDrawing, ParametricDimension, CADComponent } from "@/types/cad";

export type ProcessingPhase =
  | "converting"
  | "extracting"
  | "parsing"
  | "detecting"
  | "done";

export interface ProcessedFile {
  dxfContent: string;
  fileName: string;
  fileSize: number;
  entityCount: number;
  layerCount: number;
}

/** Extended result from batch processing — includes parsed data without loading into store */
export interface BatchProcessedFile extends ProcessedFile {
  /** The parsed drawing (for DXF/DWG) or null (for PDF — entities stored in pdfData) */
  drawing: ParsedDrawing | null;
  /** Detected components */
  components: CADComponent[];
  /** Linked parametric dimensions */
  dimensions: ParametricDimension[];
  /** Whether this file is a PDF */
  isPdf: boolean;
  /** For PDFs: the raw extracted JSON data */
  pdfData?: Record<string, unknown>;
  /** For multi-page PDFs: per-page drawings, components, and dimensions */
  pageResults?: Array<{
    pageNumber: number;
    drawing: ParsedDrawing;
    components: CADComponent[];
    dimensions: ParametricDimension[];
  }>;
}

/**
 * Process an uploaded CAD file (DXF, DWG, or PDF) and load it into the CAD store.
 * Calls `onPhase` at each major processing step for progress UI.
 */
export async function processCADFile(
  file: File,
  onPhase?: (phase: ProcessingPhase) => void
): Promise<ProcessedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  useCADStore.setState({ isLoading: true, error: null });

  try {
    if (ext === "pdf") {
      onPhase?.("extracting");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res
          .json()
          .catch(() => ({ error: "PDF extraction failed" }));
        throw new Error(errData.error || "PDF extraction failed");
      }
      const pdfData = await res.json();

      onPhase?.("detecting");
      useCADStore.getState().loadPDFEntities(pdfData, file.name);

      const store = useCADStore.getState();
      onPhase?.("done");
      return {
        dxfContent: JSON.stringify(pdfData),
        fileName: file.name,
        fileSize: file.size,
        entityCount: store.drawing?.entities.length ?? 0,
        layerCount: store.drawing?.layers.length ?? 0,
      };
    }

    if (ext === "dwg") {
      onPhase?.("converting");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "DWG conversion failed");
      }
      const dxfContent = await res.text();

      onPhase?.("parsing");
      useCADStore.getState().loadDXFFile(dxfContent, file.name);

      const store = useCADStore.getState();
      onPhase?.("done");
      return {
        dxfContent,
        fileName: file.name,
        fileSize: file.size,
        entityCount: store.drawing?.entities.length ?? 0,
        layerCount: store.drawing?.layers.length ?? 0,
      };
    }

    // DXF — read as text
    onPhase?.("parsing");
    const content = await file.text();
    useCADStore.getState().loadDXFFile(content, file.name);

    const store = useCADStore.getState();
    onPhase?.("done");
    return {
      dxfContent: content,
      fileName: file.name,
      fileSize: file.size,
      entityCount: store.drawing?.entities.length ?? 0,
      layerCount: store.drawing?.layers.length ?? 0,
    };
  } catch (err) {
    useCADStore.setState({
      isLoading: false,
      error: err instanceof Error ? err.message : "Failed to process file",
    });
    throw err;
  }
}

/**
 * Process a CAD file WITHOUT loading into the store.
 * Returns parsed data (drawing, components, dimensions) for batch analysis.
 * Used by the AI composite analysis flow.
 */
export async function processCADFileBatch(
  file: File,
  onPhase?: (phase: ProcessingPhase) => void
): Promise<BatchProcessedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    onPhase?.("extracting");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/extract-pdf", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: "PDF extraction failed" }));
      throw new Error(errData.error || "PDF extraction failed");
    }
    const pdfData = await res.json();

    onPhase?.("detecting");

    // Build per-page results without loading into store
    const pages = pdfData.pages || [];
    const pageCount = pdfData.pageCount || pages.length || 1;
    const pageResults: BatchProcessedFile["pageResults"] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const pageEntities = (pdfData.entities || [])
        .filter((e: { page?: number }) => (e.page || 1) === pageNum)
        .map((e: Record<string, unknown>) => {
          const pageInfo = pages[pageNum - 1];
          const pageHeight = pageInfo?.height || pdfData.bounds?.max?.y || 100;
          const entity: Record<string, unknown> = {
            handle: e.handle,
            type: e.type,
            layer: e.layer,
          };
          if (e.vertices) {
            entity.vertices = (e.vertices as Array<{ x: number; y: number }>).map(
              (v) => ({ x: v.x, y: pageHeight - v.y })
            );
          }
          if (e.center) {
            const c = e.center as { x: number; y: number };
            entity.center = { x: c.x, y: pageHeight - c.y };
            if (e.radius) entity.radius = e.radius;
          }
          if (e.insertionPoint) {
            const p = e.insertionPoint as { x: number; y: number };
            entity.insertionPoint = { x: p.x, y: pageHeight - p.y };
          }
          if (e.text) entity.text = e.text;
          if (e.textHeight) entity.textHeight = e.textHeight;
          if (e.closed) entity.closed = e.closed;
          if (e.colorHex) entity.colorHex = e.colorHex;
          if (e.lineWidth) entity.lineWidth = e.lineWidth;
          return entity;
        });

      // Build a drawing for this page
      const drawing = buildStandaloneDrawing(
        pageEntities,
        file.name,
        pages[pageNum - 1]
      );
      const components = detectComponents(drawing);
      drawing.components = components;
      const dimensions = linkDimensions(drawing);

      pageResults.push({ pageNumber: pageNum, drawing, components, dimensions });
    }

    onPhase?.("done");
    return {
      dxfContent: JSON.stringify(pdfData),
      fileName: file.name,
      fileSize: file.size,
      entityCount: pdfData.entityCount || 0,
      layerCount: 0,
      drawing: pageResults[0]?.drawing || null,
      components: pageResults[0]?.components || [],
      dimensions: pageResults[0]?.dimensions || [],
      isPdf: true,
      pdfData,
      pageResults,
    };
  }

  // DWG or DXF
  let dxfContent: string;

  if (ext === "dwg") {
    onPhase?.("converting");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "DWG conversion failed");
    }
    dxfContent = await res.text();
  } else {
    dxfContent = await file.text();
  }

  onPhase?.("parsing");
  const drawing = parseDXF(dxfContent, file.name);

  onPhase?.("detecting");
  const components = detectComponents(drawing);
  drawing.components = components;
  const dimensions = linkDimensions(drawing);

  onPhase?.("done");
  return {
    dxfContent,
    fileName: file.name,
    fileSize: file.size,
    entityCount: drawing.entities.length,
    layerCount: drawing.layers.length,
    drawing,
    components,
    dimensions,
    isPdf: false,
  };
}

/**
 * Build a ParsedDrawing from entities without touching the store.
 * Equivalent to buildPDFDrawing in store.ts but standalone.
 */
function buildStandaloneDrawing(
  entities: Record<string, unknown>[],
  fileName: string,
  pageInfo?: { width: number; height: number }
): ParsedDrawing {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    if (e.vertices) {
      for (const v of e.vertices as Array<{ x: number; y: number }>) {
        if (isFinite(v.x) && isFinite(v.y)) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
      }
    }
    if (e.center) {
      const c = e.center as { x: number; y: number };
      const r = (e.radius as number) || 0;
      if (c.x - r < minX) minX = c.x - r;
      if (c.y - r < minY) minY = c.y - r;
      if (c.x + r > maxX) maxX = c.x + r;
      if (c.y + r > maxY) maxY = c.y + r;
    }
    if (e.insertionPoint) {
      const p = e.insertionPoint as { x: number; y: number };
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) {
    minX = 0; minY = 0;
    maxX = pageInfo?.width || 100;
    maxY = pageInfo?.height || 100;
  }

  const layerNames = new Set(entities.map((e) => e.layer as string));
  const layers = Array.from(layerNames).map((name) => ({
    name,
    color: name === "PDF-Text" ? 7 : 0,
    visible: true,
    frozen: false,
    entityCount: entities.filter((e) => e.layer === name).length,
  }));

  return {
    fileName,
    layers,
    components: [],
    entities: entities as unknown as ParsedDrawing["entities"],
    bounds: { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } },
    units: "points",
  };
}
