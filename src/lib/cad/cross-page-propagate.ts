// Cross-page dimension propagation — when a dimension changes on one page,
// update the corresponding dimension on other pages.

import type { ParsedEntity, ParametricDimension, CADComponent } from "@/types/cad";
import type { CompositeAnalysis, CrossPageDimensionLink } from "@/types/composite";
import { modifyDimension } from "./dimension-modify";
import { linkDimensions } from "./dimension-link";

/** A PDF entity tagged with its page number (matches store definition) */
type PDFPageEntity = ParsedEntity & { _page: number };

export interface PropagationResult {
  /** Updated entity array (all pages) */
  updatedEntities: PDFPageEntity[];
  /** Updated per-page dimension maps */
  updatedDimensions: Map<string, ParametricDimension[]>;
  /** Page sources that were modified */
  propagatedPages: string[];
  /** Summary of what changed */
  summary: string;
}

/**
 * After a dimension change on one page, propagate to linked dimensions on other pages.
 * Uses mechanical (non-AI) transforms for the MVP.
 */
export function propagateDimensionChange(
  dimensionId: string,
  newValue: number,
  currentPageSource: string,
  compositeAnalysis: CompositeAnalysis,
  allPageEntities: PDFPageEntity[],
  allPageDimensions: Map<string, ParametricDimension[]>,
  pdfPages: Array<{ width: number; height: number }>,
  pdfFileName: string,
): PropagationResult {
  // Find the cross-page link that contains this dimension
  const link = findLinkForDimension(dimensionId, currentPageSource, compositeAnalysis);

  if (!link) {
    return {
      updatedEntities: allPageEntities,
      updatedDimensions: allPageDimensions,
      propagatedPages: [],
      summary: "No cross-page links found for this dimension",
    };
  }

  // Find the current instance to get the relationship context
  const currentInstance = link.instances.find(
    (inst) => inst.pageSource === currentPageSource && inst.dimensionId === dimensionId
  );
  if (!currentInstance) {
    return {
      updatedEntities: allPageEntities,
      updatedDimensions: allPageDimensions,
      propagatedPages: [],
      summary: "Current dimension not found in link instances",
    };
  }

  // Collect other page instances to propagate to
  const otherInstances = link.instances.filter(
    (inst) => inst.pageSource !== currentPageSource
  );

  if (otherInstances.length === 0) {
    return {
      updatedEntities: allPageEntities,
      updatedDimensions: allPageDimensions,
      propagatedPages: [],
      summary: "No other pages to propagate to",
    };
  }

  // Work on a mutable copy of entities
  let updatedEntities = [...allPageEntities];
  const updatedDimensions = new Map(allPageDimensions);
  const propagatedPages: string[] = [];

  for (const inst of otherInstances) {
    // Calculate the target value for this instance
    let targetValue = newValue;
    if (inst.relationship === "derived" && inst.derivationFormula) {
      try {
        targetValue = evaluateFormula(inst.derivationFormula, newValue);
      } catch {
        // If formula evaluation fails, use the direct value
        targetValue = newValue;
      }
    }

    // Get the page number from pageSource (e.g., "pdf:2" → 2)
    const pageNum = parsePageNumber(inst.pageSource);
    if (pageNum === null) continue;

    // Get entities for this page
    const pageEntityIndices: number[] = [];
    const pageEntitiesOnly: ParsedEntity[] = [];
    for (let i = 0; i < updatedEntities.length; i++) {
      if (updatedEntities[i]._page === pageNum) {
        pageEntityIndices.push(i);
        // Strip _page for dimension modify
        const { _page, ...rest } = updatedEntities[i];
        void _page;
        pageEntitiesOnly.push(rest as ParsedEntity);
      }
    }

    if (pageEntitiesOnly.length === 0) continue;

    // Get or build dimensions for this page
    let pageDims = updatedDimensions.get(inst.pageSource);
    if (!pageDims) {
      // Build dimensions from entities
      const pageInfo = pdfPages[pageNum - 1];
      const tmpDrawing = buildMinimalDrawing(pageEntitiesOnly, pdfFileName, pageInfo);
      pageDims = linkDimensions(tmpDrawing);
      updatedDimensions.set(inst.pageSource, pageDims);
    }

    // Find the target dimension on this page
    const targetDim = pageDims.find((d) => d.id === inst.dimensionId);
    if (!targetDim) continue;

    // Skip if value is already close
    if (Math.abs(targetDim.value - targetValue) < 0.01) continue;

    // Build a minimal drawing for dimension modification
    const pageInfo = pdfPages[pageNum - 1];
    const drawing = buildMinimalDrawing(pageEntitiesOnly, pdfFileName, pageInfo);

    try {
      const result = modifyDimension(drawing, pageDims, {
        dimensionId: inst.dimensionId,
        newValue: targetValue,
        proportional: false,
      });

      // Write modified entities back into the full array
      for (let j = 0; j < pageEntityIndices.length; j++) {
        const globalIdx = pageEntityIndices[j];
        const modifiedEntity = result.drawing.entities[j];
        if (modifiedEntity) {
          updatedEntities[globalIdx] = {
            ...modifiedEntity,
            _page: pageNum,
          } as PDFPageEntity;
        }
      }

      // Update the page's dimensions
      updatedDimensions.set(inst.pageSource, result.dimensions);
      propagatedPages.push(inst.pageSource);
    } catch (err) {
      console.warn(
        `[cross-page-propagate] Failed to propagate to ${inst.pageSource}:`,
        err
      );
    }
  }

  const summary =
    propagatedPages.length > 0
      ? `Propagated to ${propagatedPages.length} page${propagatedPages.length !== 1 ? "s" : ""}: ${propagatedPages.join(", ")}`
      : "No pages were updated";

  return {
    updatedEntities,
    updatedDimensions,
    propagatedPages,
    summary,
  };
}

/**
 * Find the CrossPageDimensionLink that contains a given dimension on a given page.
 */
export function findLinkForDimension(
  dimensionId: string,
  pageSource: string,
  analysis: CompositeAnalysis,
): CrossPageDimensionLink | null {
  for (const link of analysis.dimensionLinks) {
    const match = link.instances.find(
      (inst) => inst.dimensionId === dimensionId && inst.pageSource === pageSource
    );
    if (match) return link;
  }
  return null;
}

/**
 * Check if a dimension is linked across pages.
 */
export function isDimensionLinked(
  dimensionId: string,
  pageSource: string,
  analysis: CompositeAnalysis | null,
): boolean {
  if (!analysis) return false;
  const link = findLinkForDimension(dimensionId, pageSource, analysis);
  return link !== null && link.instances.length > 1;
}

/** Parse page number from page source string (e.g., "pdf:2" → 2, "dwg:0" → 1) */
function parsePageNumber(pageSource: string): number | null {
  const match = pageSource.match(/:(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  // For dwg sources, the index is 0-based but we treat it as page 1
  if (pageSource.startsWith("dwg:")) return 1;
  return num;
}

/** Safely evaluate a simple derivation formula like "value * 0.5" */
function evaluateFormula(formula: string, value: number): number {
  // Only allow simple expressions: value, numbers, +, -, *, /
  const sanitized = formula.replace(/value/g, String(value));
  if (!/^[\d\s.+\-*/()]+$/.test(sanitized)) {
    throw new Error(`Unsafe formula: ${formula}`);
  }
  // eslint-disable-next-line no-eval
  return eval(sanitized) as number;
}

/** Build a minimal ParsedDrawing from entities */
function buildMinimalDrawing(
  entities: ParsedEntity[],
  fileName: string,
  pageInfo?: { width: number; height: number },
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    if (e.vertices) {
      for (const v of e.vertices) {
        if (isFinite(v.x) && isFinite(v.y)) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
        }
      }
    }
    if (e.center) {
      const r = e.radius || 0;
      if (e.center.x - r < minX) minX = e.center.x - r;
      if (e.center.y - r < minY) minY = e.center.y - r;
      if (e.center.x + r > maxX) maxX = e.center.x + r;
      if (e.center.y + r > maxY) maxY = e.center.y + r;
    }
    if (e.insertionPoint) {
      if (e.insertionPoint.x < minX) minX = e.insertionPoint.x;
      if (e.insertionPoint.y < minY) minY = e.insertionPoint.y;
      if (e.insertionPoint.x > maxX) maxX = e.insertionPoint.x;
      if (e.insertionPoint.y > maxY) maxY = e.insertionPoint.y;
    }
  }
  if (!isFinite(minX)) {
    minX = 0; minY = 0;
    maxX = pageInfo?.width || 100;
    maxY = pageInfo?.height || 100;
  }

  const layerNames = new Set(entities.map((e) => e.layer));
  const layers = Array.from(layerNames).map((name) => ({
    name,
    color: 0,
    visible: true,
    frozen: false,
    entityCount: entities.filter((e) => e.layer === name).length,
  }));

  return {
    fileName,
    layers,
    components: [] as CADComponent[],
    entities,
    bounds: { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } },
    units: "points",
  };
}
