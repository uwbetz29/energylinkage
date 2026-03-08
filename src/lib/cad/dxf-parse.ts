// DXF file parsing — converts DXF content string into our ParsedDrawing format
import DxfParser, { type DXFOutput, type DXFEntity } from "dxf-parser";
import type {
  ParsedDrawing,
  ParsedEntity,
  DXFLayer,
  BoundingBox,
  Point2D,
} from "@/types/cad";

/**
 * Parse a DXF file string into our internal ParsedDrawing structure
 */
export function parseDXF(
  content: string,
  fileName: string
): ParsedDrawing {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);

  if (!dxf) {
    throw new Error("Failed to parse DXF file");
  }

  const layers = extractLayers(dxf);
  const entities = extractEntities(dxf);
  const bounds = calculateBounds(entities);

  return {
    fileName,
    layers,
    components: [], // Components are detected separately by component-detector
    entities,
    bounds,
    units: detectUnits(dxf),
  };
}

function extractLayers(dxf: DXFOutput): DXFLayer[] {
  const layerTable = dxf.tables?.layer;
  if (!layerTable) return [];

  return Object.entries(layerTable).map(([name, layer]) => ({
    name,
    color: layer.colorIndex ?? 7,
    visible: layer.visible !== false,
    frozen: layer.frozen === true,
    entityCount: 0, // Will be populated after entity extraction
  }));
}

function extractEntities(dxf: DXFOutput): ParsedEntity[] {
  const entities: ParsedEntity[] = [];

  if (dxf.entities) {
    for (const entity of dxf.entities) {
      const parsed = convertEntity(entity);
      if (parsed) entities.push(parsed);
    }
  }

  // Also extract entities from blocks (for INSERT references)
  if (dxf.blocks) {
    for (const [, block] of Object.entries(dxf.blocks)) {
      if (
        block.entities &&
        !block.name.startsWith("*Model_Space") &&
        !block.name.startsWith("*Paper_Space")
      ) {
        for (const entity of block.entities) {
          const parsed = convertEntity(entity);
          if (parsed) {
            parsed.blockName = block.name;
            entities.push(parsed);
          }
        }
      }
    }
  }

  return entities;
}

function convertEntity(entity: DXFEntity): ParsedEntity | null {
  const base: ParsedEntity = {
    handle: entity.handle || generateHandle(),
    type: entity.type,
    layer: entity.layer || "0",
    color: entity.colorIndex ?? entity.color,
  };

  switch (entity.type) {
    case "LINE":
      if (entity.vertices && entity.vertices.length >= 2) {
        base.vertices = entity.vertices.map((v) => ({ x: v.x, y: v.y }));
      }
      break;

    case "LWPOLYLINE":
    case "POLYLINE":
      if (entity.vertices) {
        base.vertices = entity.vertices.map((v) => ({ x: v.x, y: v.y }));
      }
      break;

    case "CIRCLE":
      if (entity.center) {
        base.center = { x: entity.center.x, y: entity.center.y };
        base.radius = entity.radius;
      }
      break;

    case "ARC":
      if (entity.center) {
        base.center = { x: entity.center.x, y: entity.center.y };
        base.radius = entity.radius;
        base.startAngle = entity.startAngle;
        base.endAngle = entity.endAngle;
      }
      break;

    case "TEXT":
    case "MTEXT":
      base.text = entity.text;
      if (entity.startPoint) {
        base.insertionPoint = {
          x: entity.startPoint.x,
          y: entity.startPoint.y,
        };
      }
      break;

    case "INSERT":
      base.blockName = entity.name;
      if (entity.position) {
        base.insertionPoint = {
          x: entity.position.x,
          y: entity.position.y,
        };
      }
      base.scaleX = entity.xScale ?? 1;
      base.scaleY = entity.yScale ?? 1;
      base.rotation = entity.rotation ?? 0;
      break;

    case "DIMENSION":
      base.dimensionType = entity.dimensionType;
      base.blockName = entity.block;
      if (entity.anchorPoint) {
        base.defPoint1 = {
          x: entity.anchorPoint.x,
          y: entity.anchorPoint.y,
        };
      }
      if (entity.middleOfText) {
        base.textPosition = {
          x: entity.middleOfText.x,
          y: entity.middleOfText.y,
        };
      }
      break;

    case "ELLIPSE":
      if (entity.center) {
        base.center = { x: entity.center.x, y: entity.center.y };
      }
      break;

    case "SPLINE":
      if (entity.controlPoints) {
        base.vertices = entity.controlPoints.map((v) => ({
          x: v.x,
          y: v.y,
        }));
      }
      break;

    case "POINT":
      if (entity.position) {
        base.vertices = [
          { x: entity.position.x, y: entity.position.y },
        ];
      }
      break;

    default:
      // Still include unknown entities with basic info
      break;
  }

  return base;
}

function calculateBounds(entities: ParsedEntity[]): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const entity of entities) {
    const points = getEntityPoints(entity);
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

function getEntityPoints(entity: ParsedEntity): Point2D[] {
  const points: Point2D[] = [];

  if (entity.vertices) {
    points.push(...entity.vertices);
  }
  if (entity.center && entity.radius) {
    points.push(
      { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
      { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
    );
  } else if (entity.center) {
    points.push(entity.center);
  }
  if (entity.insertionPoint) {
    points.push(entity.insertionPoint);
  }
  if (entity.textPosition) {
    points.push(entity.textPosition);
  }
  if (entity.defPoint1) {
    points.push(entity.defPoint1);
  }
  if (entity.defPoint2) {
    points.push(entity.defPoint2);
  }

  return points;
}

function detectUnits(dxf: DXFOutput): string {
  // Check $INSUNITS header variable
  const insunits = dxf.header?.$INSUNITS;
  if (typeof insunits === "number") {
    switch (insunits) {
      case 1:
        return "inches";
      case 2:
        return "feet";
      case 4:
        return "millimeters";
      case 6:
        return "meters";
      default:
        return "inches";
    }
  }
  return "inches"; // Default for US power generation drawings
}

let handleCounter = 0;
function generateHandle(): string {
  return `GEN_${(++handleCounter).toString(16).toUpperCase()}`;
}
