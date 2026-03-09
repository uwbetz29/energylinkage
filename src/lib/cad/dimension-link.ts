// Parametric Dimension Linker
// Scans entities for dimension text, finds nearby geometry, and creates
// ParametricDimension objects that link text values to the geometry they measure.
//
// Works for both DXF (DIMENSION entities + TEXT) and PDF imports (extracted text).

import type {
  ParsedEntity,
  ParsedDrawing,
  ParametricDimension,
  DimensionDirection,
  Point2D,
} from "@/types/cad";
import { filterDimensionCandidate } from "./dimension-filter";

// --- Public API ---

/**
 * Scan a drawing and auto-link dimension text to geometry.
 * Returns an array of ParametricDimension objects.
 */
export function linkDimensions(drawing: ParsedDrawing): ParametricDimension[] {
  const results: ParametricDimension[] = [];

  // Step 1: Find all dimension text entities (TEXT/MTEXT with dimension-like values)
  const bounds = {
    minX: drawing.bounds.min.x,
    minY: drawing.bounds.min.y,
    maxX: drawing.bounds.max.x,
    maxY: drawing.bounds.max.y,
  };
  const dimTexts = findDimensionTexts(drawing.entities, bounds);

  // Step 2: Index geometry entities for spatial queries
  const geoIndex = buildSpatialIndex(drawing.entities);

  // Step 3: For each dimension text, find the geometry it references
  const seenIds = new Set<string>();
  for (const dt of dimTexts) {
    const linked = linkSingleDimension(dt, geoIndex, drawing.entities);
    if (linked && !seenIds.has(linked.id)) {
      seenIds.add(linked.id);
      results.push(linked);
    }
  }

  return results;
}

// --- Dimension text parsing ---

/** Imperial dimension pattern: ft'-in fraction" or just inches */
const FT_IN_PATTERN = /^(\d+)'-(\d+)\s*(\d+\/\d+)?[""]?$/;
const FT_ONLY_PATTERN = /^(\d+)'-(\d+)[""]?$/;
const IN_FRAC_PATTERN = /^(\d+)\s+(\d+\/\d+)[""]?$/;
const DIAMETER_PATTERN = /^[ØÆ∅]?\s*(\d+)'-(\d+)\s*(\d+\/\d+)?[""]?$/;
const SIMPLE_NUM_PATTERN = /^(\d+\.?\d*)[""]?$/;

interface DimensionText {
  entity: ParsedEntity;
  value: number; // parsed value in inches
  displayText: string;
  direction: DimensionDirection;
  position: Point2D;
  /** Confidence from filtering (0-1). Lower = more likely junk. */
  filterConfidence: number;
}

/** Parse a text string as an imperial dimension. Returns value in inches or null. */
export function parseImperialDimension(text: string): number | null {
  const cleaned = text.trim().replace(/\u2300/g, "Ø"); // normalize diameter symbol

  // Diameter: Ø9'-0"
  let m = cleaned.match(DIAMETER_PATTERN);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inches = parseInt(m[2], 10);
    const frac = m[3] ? parseFraction(m[3]) : 0;
    return ft * 12 + inches + frac;
  }

  // Feet-inches-fraction: 45'-0 1/2"
  m = cleaned.match(FT_IN_PATTERN);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inches = parseInt(m[2], 10);
    const frac = m[3] ? parseFraction(m[3]) : 0;
    return ft * 12 + inches + frac;
  }

  // Feet-inches only: 50'-0"
  m = cleaned.match(FT_ONLY_PATTERN);
  if (m) {
    return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
  }

  // Inches with fraction: 6 1/2"
  m = cleaned.match(IN_FRAC_PATTERN);
  if (m) {
    return parseInt(m[1], 10) + parseFraction(m[2]);
  }

  // Simple number (assume inches): 24"
  m = cleaned.match(SIMPLE_NUM_PATTERN);
  if (m) {
    return parseFloat(m[1]);
  }

  return null;
}

function parseFraction(frac: string): number {
  const [num, den] = frac.split("/").map(Number);
  return den ? num / den : 0;
}

/**
 * Format a value in inches back to ft'-in fraction" display string.
 */
export function formatImperialDimension(
  totalInches: number,
  precision: number = 16
): string {
  const negative = totalInches < 0;
  totalInches = Math.abs(totalInches);

  const feet = Math.floor(totalInches / 12);
  const remainingInches = totalInches - feet * 12;
  const wholeInches = Math.floor(remainingInches);
  const fractional = remainingInches - wholeInches;

  // Find nearest fraction
  let bestNum = 0;
  let bestDen = 1;
  let bestErr = fractional;
  for (let den = 1; den <= precision; den *= 2) {
    const num = Math.round(fractional * den);
    const err = Math.abs(fractional - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
  }

  // Handle fraction overflow (e.g., 16/16 = 1 inch)
  let finalInches = wholeInches;
  let finalFeet = feet;
  if (bestNum >= bestDen) {
    finalInches += 1;
    bestNum = 0;
    bestDen = 1;
  }
  if (finalInches >= 12) {
    finalFeet += 1;
    finalInches -= 12;
  }

  const sign = negative ? "-" : "";
  if (bestNum === 0) {
    return `${sign}${finalFeet}'-${finalInches}"`;
  }
  // Reduce fraction
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(bestNum, bestDen);
  return `${sign}${finalFeet}'-${finalInches} ${bestNum / g}/${bestDen / g}"`;
}

/** Find all TEXT/MTEXT entities that look like dimension values */
function findDimensionTexts(
  entities: ParsedEntity[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): DimensionText[] {
  const results: DimensionText[] = [];

  for (const entity of entities) {
    if (
      (entity.type !== "TEXT" && entity.type !== "MTEXT") ||
      !entity.text ||
      !entity.insertionPoint
    ) {
      continue;
    }

    const value = parseImperialDimension(entity.text);
    if (value === null || value <= 0) continue;

    // Apply junk dimension filter
    const filter = filterDimensionCandidate(
      entity.text,
      value,
      entity.insertionPoint,
      bounds
    );
    if (!filter.pass) continue;

    // Detect direction from text content
    let direction: DimensionDirection = "aligned";
    if (entity.text.match(/^[ØÆ∅]/)) {
      direction = "diameter";
    }

    results.push({
      entity,
      value,
      displayText: entity.text,
      direction,
      position: entity.insertionPoint,
      filterConfidence: filter.confidence,
    });
  }

  // Also check DIMENSION entities that have measurement values
  for (const entity of entities) {
    if (entity.type !== "DIMENSION") continue;

    // If the DIMENSION entity has a measurement value, use it
    if (entity.measurementValue && entity.measurementValue > 0) {
      const pos = entity.textPosition || entity.defPoint1;
      if (!pos) continue;

      // Determine direction from dimensionType
      let direction: DimensionDirection = "aligned";
      const dimType = (entity.dimensionType ?? 0) & 0x0f; // lower 4 bits
      if (dimType === 0) direction = "horizontal"; // rotated
      if (dimType === 1) direction = "horizontal"; // horizontal
      if (dimType === 2) direction = "vertical"; // vertical
      if (dimType === 3) direction = "diameter";
      if (dimType === 4) direction = "radial";

      // DIMENSION entities from DXF are inherently trustworthy
      results.push({
        entity,
        value: entity.measurementValue,
        displayText: formatImperialDimension(entity.measurementValue),
        direction,
        position: pos,
        filterConfidence: 1.0,
      });
    }
  }

  return results;
}

// --- Spatial indexing ---

interface SpatialEntry {
  handle: string;
  type: string;
  endpoints: Point2D[];
  center?: Point2D;
  radius?: number;
}

interface SpatialIndex {
  entries: SpatialEntry[];
}

function buildSpatialIndex(entities: ParsedEntity[]): SpatialIndex {
  const entries: SpatialEntry[] = [];

  for (const entity of entities) {
    // Skip text entities — they're not geometry
    if (
      entity.type === "TEXT" ||
      entity.type === "MTEXT" ||
      entity.type === "DIMENSION" ||
      entity.type === "POINT"
    ) {
      continue;
    }

    const entry: SpatialEntry = {
      handle: entity.handle,
      type: entity.type,
      endpoints: [],
    };

    if (entity.vertices && entity.vertices.length >= 2) {
      // For lines/polylines, store all segment endpoints
      entry.endpoints = [...entity.vertices];
    }

    if (entity.center) {
      entry.center = entity.center;
      entry.radius = entity.radius;
      // For circles/arcs, add points on the circumference
      if (entity.radius) {
        const r = entity.radius;
        entry.endpoints.push(
          { x: entity.center.x + r, y: entity.center.y },
          { x: entity.center.x - r, y: entity.center.y },
          { x: entity.center.x, y: entity.center.y + r },
          { x: entity.center.x, y: entity.center.y - r }
        );
      }
    }

    if (entry.endpoints.length > 0 || entry.center) {
      entries.push(entry);
    }
  }

  return { entries };
}

// --- Dimension linking algorithm ---

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Find the closest point on a line segment to a given point */
function closestPointOnSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { point: Point2D; dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: a, dist: distance(p, a), t: 0 };

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, dist: distance(p, point), t };
}

interface LinkCandidate {
  entry: SpatialEntry;
  /** How well this geometry matches the dimension */
  score: number;
  /** The anchor points on the geometry */
  anchors: [Point2D, Point2D];
  /** Measured distance between anchors */
  measuredValue: number;
}

/**
 * For a single dimension text, find the geometry it most likely measures.
 */
function linkSingleDimension(
  dt: DimensionText & { filterConfidence: number },
  index: SpatialIndex,
  allEntities: ParsedEntity[]
): ParametricDimension | null {
  const searchRadius = dt.value * 2; // Search within 2x the dimension value
  const candidates: LinkCandidate[] = [];

  // For DIMENSION entities that already have defPoint1/defPoint2, use those directly
  if (dt.entity.type === "DIMENSION" && dt.entity.defPoint1) {
    const defPt1 = dt.entity.defPoint1;
    const defPt2 = dt.entity.defPoint2 || dt.entity.textPosition;
    if (defPt2) {
      // Find geometry near these definition points
      const nearPt1 = findNearestGeometry(defPt1, index, searchRadius);
      const nearPt2 = findNearestGeometry(defPt2, index, searchRadius);

      const geoHandles: string[] = [];
      if (nearPt1) geoHandles.push(nearPt1.handle);
      if (nearPt2 && nearPt2.handle !== nearPt1?.handle) geoHandles.push(nearPt2.handle);

      // Find annotation entities (lines, arrows near the dimension)
      const annotationHandles = findAnnotationEntities(dt, allEntities);

      return {
        id: `dim-${dt.entity.handle}`,
        textHandle: dt.entity.handle,
        displayText: dt.displayText,
        value: dt.value,
        direction: dt.direction,
        geometryHandles: geoHandles,
        anchorPoints: [defPt1, defPt2],
        annotationHandles,
        expandDirection: "end",
        sourceHandle: dt.entity.handle,
        confidence: 0.9 * dt.filterConfidence,
      };
    }
  }

  // For TEXT entities, search for geometry that matches the dimension value
  for (const entry of index.entries) {
    // Check if any pair of endpoints matches the dimension value
    if (entry.endpoints.length >= 2) {
      for (let i = 0; i < entry.endpoints.length - 1; i++) {
        const a = entry.endpoints[i];
        const b = entry.endpoints[i + 1];
        const segLen = distance(a, b);
        const mid = midpoint(a, b);
        const distToText = distance(mid, dt.position);

        // Skip if too far from the text
        if (distToText > searchRadius) continue;

        // Score based on how well the segment length matches the dimension value
        const valueDiff = Math.abs(segLen - dt.value) / dt.value;
        if (valueDiff > 0.15) continue; // More than 15% off — skip

        // Score: lower is better
        // - Value match (most important)
        // - Proximity to text
        // - Alignment (horizontal/vertical preference)
        const valueScore = 1 - valueDiff;
        const proximityScore = Math.max(0, 1 - distToText / searchRadius);

        // Check alignment
        let alignScore = 0.5;
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dt.direction === "horizontal" && dy < dx * 0.1) alignScore = 1;
        else if (dt.direction === "vertical" && dx < dy * 0.1) alignScore = 1;
        else if (dt.direction === "aligned") alignScore = 0.7;

        const score = valueScore * 0.5 + proximityScore * 0.3 + alignScore * 0.2;

        candidates.push({
          entry,
          score,
          anchors: [a, b],
          measuredValue: segLen,
        });
      }
    }

    // Check radial/diameter dimensions
    if (
      (dt.direction === "radial" || dt.direction === "diameter") &&
      entry.center &&
      entry.radius
    ) {
      const expectedRadius =
        dt.direction === "diameter" ? dt.value / 2 : dt.value;
      const radiusDiff = Math.abs(entry.radius - expectedRadius) / expectedRadius;
      if (radiusDiff < 0.1) {
        const distToText = distance(entry.center, dt.position);
        const score =
          (1 - radiusDiff) * 0.6 +
          Math.max(0, 1 - distToText / searchRadius) * 0.4;

        candidates.push({
          entry,
          score,
          anchors: [
            entry.center,
            {
              x: entry.center.x + entry.radius,
              y: entry.center.y,
            },
          ],
          measuredValue: entry.radius,
        });
      }
    }
  }

  if (candidates.length === 0) {
    // No geometry match found — still create a dimension from text alone
    // This allows manual linking later
    return {
      id: `dim-${dt.entity.handle}`,
      textHandle: dt.entity.handle,
      displayText: dt.displayText,
      value: dt.value,
      direction: dt.direction,
      geometryHandles: [],
      anchorPoints: [dt.position, { x: dt.position.x + dt.value, y: dt.position.y }],
      annotationHandles: [],
      expandDirection: "end",
      sourceHandle: dt.entity.handle,
      confidence: 0.1 * dt.filterConfidence, // Low confidence — no geometry match
    };
  }

  // Pick the best candidate
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Collect all geometry handles within the dimension span
  const geoHandles = [best.entry.handle];

  // Find annotation entities near the dimension
  const annotationHandles = findAnnotationEntities(dt, allEntities);

  // Determine expand direction based on position relative to anchors
  let expandDirection: "both" | "start" | "end" = "end";
  const anchorMid = midpoint(best.anchors[0], best.anchors[1]);
  const textOffset = {
    x: dt.position.x - anchorMid.x,
    y: dt.position.y - anchorMid.y,
  };
  if (
    Math.abs(textOffset.x) < dt.value * 0.1 &&
    Math.abs(textOffset.y) < dt.value * 0.1
  ) {
    expandDirection = "both"; // text is centered over the dimension
  }

  return {
    id: `dim-${dt.entity.handle}`,
    textHandle: dt.entity.handle,
    displayText: dt.displayText,
    value: dt.value,
    direction: dt.direction,
    geometryHandles: geoHandles,
    anchorPoints: best.anchors,
    annotationHandles,
    expandDirection,
    sourceHandle: dt.entity.handle,
    confidence: Math.min(1, best.score) * dt.filterConfidence,
  };
}

/** Find the nearest geometry entry to a point */
function findNearestGeometry(
  point: Point2D,
  index: SpatialIndex,
  maxDist: number
): SpatialEntry | null {
  let best: SpatialEntry | null = null;
  let bestDist = maxDist;

  for (const entry of index.entries) {
    // Check distance to all endpoints
    for (const ep of entry.endpoints) {
      const d = distance(point, ep);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    }
    // Check distance to center
    if (entry.center) {
      const d = distance(point, entry.center);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    }
  }

  return best;
}

/**
 * Find entities that are part of the dimension annotation (extension lines,
 * leader lines, arrows) — short lines near the dimension text.
 */
function findAnnotationEntities(
  dt: DimensionText,
  allEntities: ParsedEntity[]
): string[] {
  const handles: string[] = [];
  const maxDist = dt.value * 0.5; // Annotations should be close to the text

  for (const entity of allEntities) {
    if (entity.type !== "LINE" && entity.type !== "LWPOLYLINE") continue;
    if (!entity.vertices || entity.vertices.length < 2) continue;

    // Short lines near the text are likely extension/leader lines
    const segLen = distance(entity.vertices[0], entity.vertices[entity.vertices.length - 1]);
    if (segLen > dt.value * 0.8) continue; // Skip lines longer than the dimension

    // Check if any vertex is close to the text position
    for (const v of entity.vertices) {
      if (distance(v, dt.position) < maxDist) {
        handles.push(entity.handle);
        break;
      }
    }
  }

  return handles;
}
