// Component detection — identifies named equipment components from DXF layers and entity groupings
// Focused on SCR/CO catalyst systems initially, architected for expansion

import type {
  ParsedDrawing,
  ParsedEntity,
  CADComponent,
  ComponentType,
  ComponentDimension,
  BoundingBox,
  Point2D,
} from "@/types/cad";
import { inchesToImperial } from "./units";

// Layer name patterns that map to component types
const LAYER_PATTERNS: Array<{
  pattern: RegExp;
  type: ComponentType;
  displayName: string;
}> = [
  { pattern: /stack/i, type: "stack", displayName: "Stack" },
  { pattern: /silencer/i, type: "silencer", displayName: "Silencer" },
  { pattern: /gas[\s_-]?path/i, type: "gas-path", displayName: "Gas Path" },
  {
    pattern: /d\.?i\.?\s*duct|direct[\s_-]?inject/i,
    type: "di-duct",
    displayName: "D.I. Duct",
  },
  {
    pattern: /t\.?a\.?\s*duct|temper/i,
    type: "ta-duct",
    displayName: "T.A. Duct",
  },
  {
    pattern: /dist[\s_.-]?grid|distribution/i,
    type: "dist-grid-duct",
    displayName: "Dist. Grid Duct",
  },
  { pattern: /scr[\s_-]?duct/i, type: "scr-duct", displayName: "SCR Duct" },
  {
    pattern: /liner|inside[\s_-]?liner/i,
    type: "inside-liner",
    displayName: "Inside Liner",
  },
  { pattern: /nozzle|^N\d+$/i, type: "nozzle", displayName: "Nozzle" },
  {
    pattern: /platform|access/i,
    type: "platform",
    displayName: "Access Platform",
  },
  { pattern: /ladder/i, type: "ladder", displayName: "Roof Access Ladder" },
];

// Component colors for visual distinction
const COMPONENT_COLORS: Record<ComponentType, string> = {
  stack: "#4A90D9",
  silencer: "#D94A4A",
  "gas-path": "#D9A04A",
  "di-duct": "#4AD99A",
  "ta-duct": "#9A4AD9",
  "dist-grid-duct": "#D94A9A",
  "scr-duct": "#4AD9D9",
  "inside-liner": "#D9D94A",
  nozzle: "#FF6B35",
  platform: "#7B8794",
  ladder: "#6B7B35",
  unknown: "#888888",
};

/**
 * Detect components in a parsed drawing by analyzing layers, blocks, and text labels
 */
export function detectComponents(drawing: ParsedDrawing): CADComponent[] {
  const components: CADComponent[] = [];
  let componentId = 0;

  // Strategy 1: Group entities by layer and match to known component types
  const entitiesByLayer = groupByLayer(drawing.entities);

  for (const [layerName, entities] of entitiesByLayer) {
    const match = matchLayerToComponent(layerName);
    if (match) {
      const bounds = calculateEntityBounds(entities);
      const dimensions = extractDimensions(entities, match.type);

      components.push({
        id: `comp_${++componentId}`,
        name: match.displayName,
        type: match.type,
        layerName,
        boundingBox: bounds,
        entityHandles: entities.map((e) => e.handle),
        dimensions,
        color: COMPONENT_COLORS[match.type],
      });
    }
  }

  // Strategy 2: If no layer-based components found, try text label detection
  if (components.length === 0) {
    const textComponents = detectFromTextLabels(drawing.entities);
    components.push(...textComponents);
  }

  // Strategy 3: If still no components, create spatial regions
  if (components.length === 0) {
    const spatialComponents = detectSpatialComponents(drawing);
    components.push(...spatialComponents);
  }

  return components;
}

function groupByLayer(
  entities: ParsedEntity[]
): Map<string, ParsedEntity[]> {
  const groups = new Map<string, ParsedEntity[]>();
  for (const entity of entities) {
    const layer = entity.layer || "0";
    if (!groups.has(layer)) groups.set(layer, []);
    groups.get(layer)!.push(entity);
  }
  return groups;
}

function matchLayerToComponent(
  layerName: string
): { type: ComponentType; displayName: string } | null {
  for (const pattern of LAYER_PATTERNS) {
    if (pattern.pattern.test(layerName)) {
      return { type: pattern.type, displayName: pattern.displayName };
    }
  }
  return null;
}

function calculateEntityBounds(entities: ParsedEntity[]): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const entity of entities) {
    const points = getEntityExtents(entity);
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

function getEntityExtents(entity: ParsedEntity): Point2D[] {
  const points: Point2D[] = [];
  if (entity.vertices) points.push(...entity.vertices);
  if (entity.center && entity.radius) {
    points.push(
      { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
      { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
    );
  } else if (entity.center) {
    points.push(entity.center);
  }
  if (entity.insertionPoint) points.push(entity.insertionPoint);
  return points;
}

function extractDimensions(
  entities: ParsedEntity[],
  componentType: ComponentType
): ComponentDimension[] {
  const dimensions: ComponentDimension[] = [];
  let dimId = 0;

  // Look for DIMENSION entities
  const dimEntities = entities.filter((e) => e.type === "DIMENSION");
  for (const dim of dimEntities) {
    if (dim.defPoint1 && dim.defPoint2) {
      const dx = dim.defPoint2.x - dim.defPoint1.x;
      const dy = dim.defPoint2.y - dim.defPoint1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      dimensions.push({
        id: `dim_${++dimId}`,
        label: dim.text || (isHorizontal ? "Width" : "Height"),
        value: length,
        displayValue: inchesToImperial(length),
        direction: isHorizontal ? "horizontal" : "vertical",
        entityHandle: dim.handle,
      });
    }
  }

  // Also look for TEXT entities that contain dimension-like values
  const textEntities = entities.filter(
    (e) =>
      (e.type === "TEXT" || e.type === "MTEXT") &&
      e.text &&
      /\d+['-]/.test(e.text)
  );
  for (const text of textEntities) {
    if (text.text) {
      dimensions.push({
        id: `dim_${++dimId}`,
        label: text.text,
        value: 0, // Will be parsed from the text
        displayValue: text.text,
        direction: inferDimensionDirection(text, componentType),
        entityHandle: text.handle,
      });
    }
  }

  return dimensions;
}

function inferDimensionDirection(
  entity: ParsedEntity,
  _componentType: ComponentType
): "horizontal" | "vertical" | "diameter" {
  // If the text contains Ø, it's a diameter
  if (entity.text?.includes("Ø")) return "diameter";

  // Use text rotation to infer direction
  if (entity.rotation && Math.abs(entity.rotation - 90) < 10) {
    return "vertical";
  }
  return "horizontal";
}

/**
 * Detect components from text labels in the drawing
 * Looks for known labels like "4000 STACK", "SILENCER", etc.
 */
function detectFromTextLabels(entities: ParsedEntity[]): CADComponent[] {
  const components: CADComponent[] = [];
  const textEntities = entities.filter(
    (e) => e.type === "TEXT" || e.type === "MTEXT"
  );
  let componentId = 100;

  const labelPatterns: Array<{
    pattern: RegExp;
    type: ComponentType;
    name: string;
  }> = [
    { pattern: /4000\s*STACK/i, type: "stack", name: "4000 Stack" },
    { pattern: /SILENCER/i, type: "silencer", name: "Silencer" },
    { pattern: /GAS\s*PATH/i, type: "gas-path", name: "Gas Path" },
    { pattern: /D\.?I\.?\s*DUCT|1000\s*D/i, type: "di-duct", name: "D.I. Duct (1000)" },
    { pattern: /T\.?A\.?\s*DUCT|1100\s*T/i, type: "ta-duct", name: "T.A. Duct (1100)" },
    {
      pattern: /DIST\.?\s*GRID|2000\s*D/i,
      type: "dist-grid-duct",
      name: "Dist. Grid Duct (2000)",
    },
    { pattern: /SCR\s*DUCT|3100\s*S/i, type: "scr-duct", name: "SCR Duct (3100)" },
    { pattern: /INSIDE\s*LINER/i, type: "inside-liner", name: "Inside Liner" },
  ];

  for (const text of textEntities) {
    if (!text.text) continue;
    for (const lp of labelPatterns) {
      if (lp.pattern.test(text.text)) {
        // Find nearby entities to form the component
        const nearby = findNearbyEntities(
          text.insertionPoint || { x: 0, y: 0 },
          entities,
          50 // search radius in drawing units
        );

        components.push({
          id: `comp_${++componentId}`,
          name: lp.name,
          type: lp.type,
          layerName: text.layer,
          boundingBox: calculateEntityBounds(nearby),
          entityHandles: nearby.map((e) => e.handle),
          dimensions: [],
          color: COMPONENT_COLORS[lp.type],
        });
        break;
      }
    }
  }

  return components;
}

function findNearbyEntities(
  point: Point2D,
  entities: ParsedEntity[],
  radius: number
): ParsedEntity[] {
  return entities.filter((entity) => {
    const points = getEntityExtents(entity);
    return points.some(
      (p) =>
        Math.abs(p.x - point.x) < radius &&
        Math.abs(p.y - point.y) < radius
    );
  });
}

/**
 * Fallback: create spatial components by dividing the drawing into quadrants
 */
function detectSpatialComponents(
  drawing: ParsedDrawing
): CADComponent[] {
  const { bounds } = drawing;
  const midX = (bounds.min.x + bounds.max.x) / 2;
  const midY = (bounds.min.y + bounds.max.y) / 2;

  const regions: Array<{
    name: string;
    type: ComponentType;
    bounds: BoundingBox;
  }> = [
    {
      name: "Upper Section",
      type: "stack",
      bounds: { min: { x: bounds.min.x, y: midY }, max: bounds.max },
    },
    {
      name: "Lower Section",
      type: "gas-path",
      bounds: { min: bounds.min, max: { x: bounds.max.x, y: midY } },
    },
  ];

  return regions.map((region, i) => {
    const entitiesInRegion = drawing.entities.filter((e) => {
      const points = getEntityExtents(e);
      return points.some(
        (p) =>
          p.x >= region.bounds.min.x &&
          p.x <= region.bounds.max.x &&
          p.y >= region.bounds.min.y &&
          p.y <= region.bounds.max.y
      );
    });

    return {
      id: `comp_spatial_${i}`,
      name: region.name,
      type: region.type,
      layerName: "0",
      boundingBox: region.bounds,
      entityHandles: entitiesInRegion.map((e) => e.handle),
      dimensions: [],
      color: COMPONENT_COLORS[region.type],
    };
  });
}
