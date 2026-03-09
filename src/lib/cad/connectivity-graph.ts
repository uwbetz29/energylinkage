// Connectivity Graph
// Builds a connectivity graph from AI-recognized components and uses it
// to enhance cascade suggestions with domain-aware reasoning.

import type { Point2D, ParametricDimension, CascadeSuggestion } from "@/types/cad";
import type {
  RecognizedComponent,
  ComponentEdge,
  ComponentGraph,
  FlowDirection,
} from "@/types/component-recognition";
import { formatImperialDimension } from "./dimension-link";

/** Typical flow order for SCR/CO systems (upstream → downstream) */
const FLOW_ORDER: Record<string, number> = {
  "gas-path": 0,
  "di-duct": 1,
  "ta-duct": 2,
  "dist-grid-duct": 3,
  "scr-duct": 4,
  "silencer": 5,
  "stack": 6,
};

/**
 * Build connectivity edges from recognized components.
 * Uses spatial adjacency and domain knowledge of gas flow order.
 */
export function buildConnectivityGraph(
  components: RecognizedComponent[],
  flowDirection: FlowDirection
): ComponentEdge[] {
  const edges: ComponentEdge[] = [];

  // Sort components by their position along the flow direction
  const sorted = [...components].sort((a, b) => {
    const centerA = boxCenter(a.boundingBox);
    const centerB = boxCenter(b.boundingBox);
    switch (flowDirection) {
      case "left-to-right": return centerA.x - centerB.x;
      case "right-to-left": return centerB.x - centerA.x;
      case "bottom-to-top": return centerA.y - centerB.y;
      case "top-to-bottom": return centerB.y - centerA.y;
    }
  });

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Check if bounding boxes share or nearly share an edge
      const overlap = boundaryOverlap(a.boundingBox, b.boundingBox, flowDirection);
      if (!overlap) continue;

      // Determine relationship based on flow order
      const orderA = FLOW_ORDER[a.type] ?? -1;
      const orderB = FLOW_ORDER[b.type] ?? -1;

      let relationship: ComponentEdge["relationship"];
      if (a.type === "inside-liner" || b.type === "inside-liner") {
        // Inside liners are contained within ducts
        relationship = "contains";
      } else if (a.type === "platform" || a.type === "ladder" || b.type === "platform" || b.type === "ladder") {
        relationship = "lateral";
      } else if (orderA >= 0 && orderB >= 0) {
        relationship = orderA < orderB ? "upstream" : "downstream";
      } else {
        // Unknown flow order — use spatial proximity
        relationship = "lateral";
      }

      edges.push({
        from: relationship === "downstream" ? b.id : a.id,
        to: relationship === "downstream" ? a.id : b.id,
        relationship: relationship === "downstream" ? "upstream" : relationship,
        sharedBoundary: overlap.boundary,
      });
    }
  }

  return edges;
}

/**
 * Use connectivity graph to produce smarter cascade suggestions.
 * Downstream components get shift suggestions with high confidence.
 */
export function analyzeConnectedCascade(
  graph: ComponentGraph,
  modifiedDimensionId: string,
  displacement: Point2D,
  allDimensions: ParametricDimension[]
): CascadeSuggestion[] {
  const displMag = Math.sqrt(displacement.x * displacement.x + displacement.y * displacement.y);
  if (displMag < 0.001) return [];

  // Find which component owns the modified dimension
  const ownerComponent = graph.components.find(c =>
    c.dimensionIds.includes(modifiedDimensionId)
  );
  if (!ownerComponent) return [];

  // Build adjacency map
  const downstreamIds = new Set<string>();
  const sameComponentDims = new Set<string>();
  const lateralIds = new Set<string>();

  // Traverse edges to find downstream components
  const visited = new Set<string>();
  const queue = [ownerComponent.id];
  visited.add(ownerComponent.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of graph.edges) {
      // Find edges where current component is upstream (from)
      if (edge.from === currentId && edge.relationship === "upstream") {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          downstreamIds.add(edge.to);
          queue.push(edge.to);
        }
      }
      // Also check lateral at the same level
      if (edge.relationship === "lateral") {
        if (edge.from === currentId && !visited.has(edge.to)) {
          lateralIds.add(edge.to);
        }
        if (edge.to === currentId && !visited.has(edge.from)) {
          lateralIds.add(edge.from);
        }
      }
    }
  }

  // Collect dimension IDs owned by the same component (excluding the modified one)
  for (const dimId of ownerComponent.dimensionIds) {
    if (dimId !== modifiedDimensionId) {
      sameComponentDims.add(dimId);
    }
  }

  const suggestions: CascadeSuggestion[] = [];

  for (const dim of allDimensions) {
    if (dim.id === modifiedDimensionId) continue;
    if (dim.confidence < 0.15) continue;

    // Find which component owns this dimension
    const dimOwner = graph.components.find(c => c.dimensionIds.includes(dim.id));
    if (!dimOwner) continue;

    if (downstreamIds.has(dimOwner.id)) {
      // Downstream component → shift with high confidence
      suggestions.push({
        dimensionId: dim.id,
        displayText: dim.displayText,
        action: "shift",
        displacement,
        reason: `Shift ${dimOwner.label} (downstream)`,
        confidence: "high",
      });
    } else if (sameComponentDims.has(dim.id)) {
      // Same component → may need resize
      suggestions.push({
        dimensionId: dim.id,
        displayText: dim.displayText,
        action: "resize",
        suggestedNewValue: dim.value, // User decides the actual value
        reason: `Review ${ownerComponent.label} (same component)`,
        confidence: "medium",
      });
    } else if (lateralIds.has(dimOwner.id)) {
      // Lateral component → shift if sharing boundary
      const edge = graph.edges.find(e =>
        (e.from === ownerComponent.id && e.to === dimOwner.id) ||
        (e.to === ownerComponent.id && e.from === dimOwner.id)
      );
      if (edge?.sharedBoundary) {
        suggestions.push({
          dimensionId: dim.id,
          displayText: dim.displayText,
          action: "shift",
          displacement,
          reason: `Shift ${dimOwner.label} (lateral, shares ${edge.sharedBoundary} boundary)`,
          confidence: "medium",
        });
      }
    }
  }

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return suggestions;
}

// --- Helpers ---

function boxCenter(box: { minX: number; minY: number; maxX: number; maxY: number }) {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
  };
}

/** Check if two bounding boxes share or nearly share a boundary */
function boundaryOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  flowDirection: FlowDirection
): { boundary: "top" | "bottom" | "left" | "right" } | null {
  // Compute gap between boxes in each direction
  const tolerance = Math.max(
    (a.maxX - a.minX) * 0.15,
    (a.maxY - a.minY) * 0.15,
    20
  );

  // Check horizontal adjacency (a is left of b)
  const hGap = b.minX - a.maxX;
  const hOverlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (Math.abs(hGap) < tolerance && hOverlapY > 0) {
    return { boundary: "right" };
  }

  // Check horizontal adjacency (b is left of a)
  const hGap2 = a.minX - b.maxX;
  if (Math.abs(hGap2) < tolerance && hOverlapY > 0) {
    return { boundary: "left" };
  }

  // Check vertical adjacency (a is below b)
  const vGap = b.minY - a.maxY;
  const vOverlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  if (Math.abs(vGap) < tolerance && vOverlapX > 0) {
    return { boundary: "top" };
  }

  // Check vertical adjacency (b is below a)
  const vGap2 = a.minY - b.maxY;
  if (Math.abs(vGap2) < tolerance && vOverlapX > 0) {
    return { boundary: "bottom" };
  }

  return null;
}
