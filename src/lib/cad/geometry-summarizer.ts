// Geometry Summarizer
// Compresses 58K+ drawing entities into a compact summary (~2000 tokens)
// for AI component recognition. Extracts text labels, spatial regions,
// and dimension summaries.

import type { ParsedDrawing, ParsedEntity, ParametricDimension } from "@/types/cad";
import type { TextLabel, Region, DimSummary, GeometrySummary } from "@/types/component-recognition";

/** Number of grid cells per axis (total cells = GRID_SIZE^2) */
const GRID_SIZE = 5;

/**
 * Summarize a drawing into a compact representation for AI consumption.
 */
export function summarizeGeometry(
  drawing: ParsedDrawing,
  dimensions: ParametricDimension[]
): GeometrySummary {
  const textLabels = extractTextLabels(drawing.entities, dimensions);
  const regions = buildRegions(drawing);
  const dimensionSummary = summarizeDimensions(dimensions);

  return { textLabels, regions, dimensionSummary };
}

/**
 * Extract text labels from the drawing, excluding dimension text.
 * Deduplicates and keeps only substantive labels.
 */
function extractTextLabels(
  entities: ParsedEntity[],
  dimensions: ParametricDimension[]
): TextLabel[] {
  // Build a set of dimension text handles to exclude
  const dimTextHandles = new Set(dimensions.map(d => d.textHandle));

  const seen = new Set<string>();
  const labels: TextLabel[] = [];

  for (const entity of entities) {
    if (entity.type !== "TEXT" && entity.type !== "MTEXT") continue;
    if (!entity.text || !entity.insertionPoint) continue;
    if (dimTextHandles.has(entity.handle)) continue;

    const text = entity.text.trim();
    // Skip very short or purely numeric text
    if (text.length < 2) continue;
    if (/^\d+$/.test(text)) continue;

    // Deduplicate by normalized text
    const key = text.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    labels.push({
      text,
      position: entity.insertionPoint,
      height: entity.textHeight || 0,
    });
  }

  // Sort by text height (larger = more important labels) and limit
  labels.sort((a, b) => b.height - a.height);
  return labels.slice(0, 100);
}

/**
 * Divide the drawing into a grid and count entity density per cell.
 * Returns only cells with significant entity counts.
 */
function buildRegions(drawing: ParsedDrawing): Region[] {
  const { min, max } = drawing.bounds;
  const width = max.x - min.x;
  const height = max.y - min.y;
  if (width <= 0 || height <= 0) return [];

  const cellW = width / GRID_SIZE;
  const cellH = height / GRID_SIZE;

  // Initialize grid
  const grid: { count: number; types: Map<string, number> }[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      grid[row][col] = { count: 0, types: new Map() };
    }
  }

  // Classify entities into grid cells based on their center point
  for (const entity of drawing.entities) {
    if (entity.type === "TEXT" || entity.type === "MTEXT") continue;

    const center = getEntityCenter(entity);
    if (!center) continue;

    const col = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((center.x - min.x) / cellW)));
    const row = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor((center.y - min.y) / cellH)));

    grid[row][col].count++;
    const typeCount = grid[row][col].types.get(entity.type) || 0;
    grid[row][col].types.set(entity.type, typeCount + 1);
  }

  // Convert to Region objects, filtering out empty/sparse cells
  const regions: Region[] = [];
  const minCount = Math.max(10, drawing.entities.length * 0.005); // At least 0.5% of entities

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = grid[row][col];
      if (cell.count < minCount) continue;

      // Get top 3 entity types in this cell
      const sortedTypes = Array.from(cell.types.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);

      regions.push({
        id: `r${row}-${col}`,
        bounds: {
          minX: min.x + col * cellW,
          minY: min.y + row * cellH,
          maxX: min.x + (col + 1) * cellW,
          maxY: min.y + (row + 1) * cellH,
        },
        entityCount: cell.count,
        dominantTypes: sortedTypes,
      });
    }
  }

  return regions;
}

/**
 * Summarize dimensions for AI consumption.
 */
function summarizeDimensions(dimensions: ParametricDimension[]): DimSummary[] {
  return dimensions
    .filter(d => d.confidence >= 0.15) // Skip junk dimensions
    .map(d => ({
      id: d.id,
      displayText: d.displayText,
      valueInches: d.value,
      midpoint: {
        x: (d.anchorPoints[0].x + d.anchorPoints[1].x) / 2,
        y: (d.anchorPoints[0].y + d.anchorPoints[1].y) / 2,
      },
      direction: d.direction,
    }));
}

/** Get the center point of an entity (for spatial binning) */
function getEntityCenter(entity: ParsedEntity): { x: number; y: number } | null {
  if (entity.center) return entity.center;
  if (entity.insertionPoint) return entity.insertionPoint;
  if (entity.vertices && entity.vertices.length > 0) {
    let sx = 0, sy = 0;
    for (const v of entity.vertices) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / entity.vertices.length, y: sy / entity.vertices.length };
  }
  return null;
}
