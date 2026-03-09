// Find which component a dimension belongs to

import type { CADComponent, ParametricDimension, Point2D } from "@/types/cad";

/**
 * Find the component that a dimension most likely belongs to.
 *
 * Strategy:
 * 1. Check which component's entityHandles overlap with the dimension's geometryHandles
 * 2. Fall back to spatial containment (dimension anchors inside component bounding box)
 */
export function findComponentForDimension(
  dim: ParametricDimension,
  components: CADComponent[]
): CADComponent | null {
  if (components.length === 0) return null;

  // Strategy 1: Handle overlap
  let bestComponent: CADComponent | null = null;
  let bestOverlap = 0;

  for (const comp of components) {
    const compHandleSet = new Set(comp.entityHandles);
    let overlap = 0;
    for (const h of dim.geometryHandles) {
      if (compHandleSet.has(h)) overlap++;
    }
    if (compHandleSet.has(dim.textHandle)) overlap++;

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestComponent = comp;
    }
  }

  if (bestComponent) return bestComponent;

  // Strategy 2: Spatial containment with tolerance
  const dimMid: Point2D = {
    x: (dim.anchorPoints[0].x + dim.anchorPoints[1].x) / 2,
    y: (dim.anchorPoints[0].y + dim.anchorPoints[1].y) / 2,
  };

  for (const comp of components) {
    const { min, max } = comp.boundingBox;
    const margin = Math.max(max.x - min.x, max.y - min.y) * 0.1;
    if (
      dimMid.x >= min.x - margin &&
      dimMid.x <= max.x + margin &&
      dimMid.y >= min.y - margin &&
      dimMid.y <= max.y + margin
    ) {
      return comp;
    }
  }

  return null;
}
