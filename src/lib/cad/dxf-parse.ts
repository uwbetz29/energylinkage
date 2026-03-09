// DXF file parsing — converts DXF content string into our ParsedDrawing format
// Key design: block INSERT references are flattened into the entity list with
// their transforms applied, so the renderer only sees simple geometry primitives.
import DxfParser from "dxf-parser";
// @ts-expect-error — dxf-parser exports IDxf but TS can't resolve it alongside the default export
import type { IDxf, IBlock, IEntity, IPoint } from "dxf-parser";
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
export function parseDXF(content: string, fileName: string): ParsedDrawing {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);

  if (!dxf) {
    throw new Error("Failed to parse DXF file");
  }

  const layers = extractLayers(dxf);
  const blockMap = buildBlockMap(dxf);
  const entities = flattenEntities(dxf.entities || [], blockMap);
  const bounds = calculateBounds(entities);

  // Count entities per layer
  const layerCounts: Record<string, number> = {};
  for (const e of entities) {
    layerCounts[e.layer] = (layerCounts[e.layer] || 0) + 1;
  }
  for (const layer of layers) {
    layer.entityCount = layerCounts[layer.name] || 0;
  }

  return {
    fileName,
    layers,
    components: [],
    entities,
    bounds,
    units: detectUnits(dxf),
  };
}

function extractLayers(dxf: IDxf): DXFLayer[] {
  const layerTable = dxf.tables?.layer;
  if (!layerTable || !("layers" in layerTable)) return [];

  const layersObj = (layerTable as { layers: Record<string, { name: string; colorIndex?: number; color?: number; visible?: boolean; frozen?: boolean }> }).layers;
  if (!layersObj) return [];

  return Object.entries(layersObj).map(([name, layer]) => ({
    name,
    color: layer.colorIndex ?? 7,
    visible: layer.visible !== false,
    frozen: layer.frozen === true,
    entityCount: 0,
  }));
}

/**
 * Build a map of block name → block definition entities
 * Skip model/paper space pseudo-blocks
 */
function buildBlockMap(dxf: IDxf): Map<string, IBlock> {
  const map = new Map<string, IBlock>();
  if (!dxf.blocks) return map;

  for (const [name, block] of Object.entries(dxf.blocks)) {
    // Skip model/paper space — their entities are already in dxf.entities
    if (name.startsWith("*Model_Space") || name.startsWith("*Paper_Space")) {
      continue;
    }
    map.set(name, block);
  }
  return map;
}

interface Transform {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  rotation: number; // degrees
}

const IDENTITY_TRANSFORM: Transform = { tx: 0, ty: 0, sx: 1, sy: 1, rotation: 0 };

/**
 * Flatten the top-level entity list, expanding INSERT references
 * into their constituent geometry with transforms applied.
 */
function flattenEntities(
  topEntities: IEntity[],
  blockMap: Map<string, IBlock>,
  maxDepth: number = 8
): ParsedEntity[] {
  const result: ParsedEntity[] = [];

  function processEntities(
    entities: IEntity[],
    transform: Transform,
    depth: number
  ) {
    if (depth > maxDepth) return;

    for (const entity of entities) {
      if (entity.type === "INSERT") {
        // Expand block reference
        const ins = entity as IEntity & {
          name?: string;
          position?: IPoint;
          xScale?: number;
          yScale?: number;
          rotation?: number;
          columnCount?: number;
          rowCount?: number;
          columnSpacing?: number;
          rowSpacing?: number;
        };
        const blockName = ins.name;
        if (!blockName) continue;

        const block = blockMap.get(blockName);
        if (!block || !block.entities) continue;

        const ix = ins.position?.x ?? 0;
        const iy = ins.position?.y ?? 0;
        const isx = ins.xScale ?? 1;
        const isy = ins.yScale ?? 1;
        const irot = ins.rotation ?? 0;

        // Compose transforms
        const childTransform = composeTransform(transform, {
          tx: ix,
          ty: iy,
          sx: isx,
          sy: isy,
          rotation: irot,
        });

        // Handle array inserts (column/row patterns)
        const cols = ins.columnCount ?? 1;
        const rows = ins.rowCount ?? 1;
        const colSpacing = ins.columnSpacing ?? 0;
        const rowSpacing = ins.rowSpacing ?? 0;

        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            const arrayTransform: Transform = {
              ...childTransform,
              tx: childTransform.tx + col * colSpacing * transform.sx,
              ty: childTransform.ty + row * rowSpacing * transform.sy,
            };
            processEntities(block.entities, arrayTransform, depth + 1);
          }
        }
      } else if (entity.type === "DIMENSION") {
        // Expand the dimension's visual block reference (contains lines, arrows, text)
        const dimE = entity as Record<string, unknown>;
        const blockName = dimE.block as string | undefined;
        if (blockName) {
          const block = blockMap.get(blockName);
          if (block?.entities) {
            processEntities(block.entities, transform, depth + 1);
          }
        }
        // Also keep the DIMENSION metadata entity
        const parsed = convertEntity(entity, transform);
        if (parsed) result.push(parsed);
      } else if (entity.type === "HATCH") {
        // Expand hatch boundaries into renderable geometry (outlines)
        expandHatchBoundaries(entity, transform, result);
      } else {
        // Convert and transform the entity
        const parsed = convertEntity(entity, transform);
        if (parsed) result.push(parsed);
      }
    }
  }

  processEntities(topEntities, IDENTITY_TRANSFORM, 0);
  return result;
}

/**
 * Compose parent and child transforms.
 * Parent transform is applied first, then child.
 */
function composeTransform(parent: Transform, child: Transform): Transform {
  const cosP = Math.cos((parent.rotation * Math.PI) / 180);
  const sinP = Math.sin((parent.rotation * Math.PI) / 180);

  return {
    tx: parent.tx + (child.tx * cosP - child.ty * sinP) * parent.sx,
    ty: parent.ty + (child.tx * sinP + child.ty * cosP) * parent.sy,
    sx: parent.sx * child.sx,
    sy: parent.sy * child.sy,
    rotation: parent.rotation + child.rotation,
  };
}

/**
 * Apply a transform to a 2D point
 */
function transformPoint(p: Point2D, t: Transform): Point2D {
  const cos = Math.cos((t.rotation * Math.PI) / 180);
  const sin = Math.sin((t.rotation * Math.PI) / 180);
  return {
    x: t.tx + (p.x * cos - p.y * sin) * t.sx,
    y: t.ty + (p.x * sin + p.y * cos) * t.sy,
  };
}

function convertEntity(
  entity: IEntity,
  transform: Transform
): ParsedEntity | null {
  const base: ParsedEntity = {
    handle: entity.handle || generateHandle(),
    type: entity.type,
    layer: entity.layer || "0",
    color: (entity as { colorIndex?: number }).colorIndex ?? (entity as { color?: number }).color,
  };

  const e = entity as Record<string, unknown>;

  switch (entity.type) {
    case "LINE": {
      const verts = e.vertices as IPoint[] | undefined;
      if (verts && verts.length >= 2) {
        base.vertices = verts.map((v) => transformPoint({ x: v.x, y: v.y }, transform));
      }
      break;
    }

    case "LWPOLYLINE":
    case "POLYLINE": {
      const verts = e.vertices as IPoint[] | undefined;
      if (verts && verts.length >= 2) {
        base.vertices = verts.map((v) => transformPoint({ x: v.x, y: v.y }, transform));
        // Handle closed polylines
        if (e.shape === true && verts.length > 2) {
          base.closed = true;
        }
      }
      // Store bulge values for curved segments
      if (verts) {
        const bulges = verts.map((v) => (v as { bulge?: number }).bulge ?? 0);
        if (bulges.some((b) => b !== 0)) {
          base.bulges = bulges;
        }
      }
      break;
    }

    case "CIRCLE": {
      const center = e.center as IPoint | undefined;
      const radius = e.radius as number | undefined;
      if (center && radius) {
        base.center = transformPoint({ x: center.x, y: center.y }, transform);
        base.radius = radius * Math.abs(transform.sx);
      }
      break;
    }

    case "ARC": {
      const center = e.center as IPoint | undefined;
      const radius = e.radius as number | undefined;
      if (center && radius) {
        base.center = transformPoint({ x: center.x, y: center.y }, transform);
        base.radius = radius * Math.abs(transform.sx);
        let sa = (e.startAngle as number) ?? 0;
        let ea = (e.endAngle as number) ?? 360;
        // Adjust angles for transform rotation
        sa += transform.rotation;
        ea += transform.rotation;
        // Handle mirroring (negative scale flips angles)
        if (transform.sx * transform.sy < 0) {
          const tmp = sa;
          sa = -ea;
          ea = -tmp;
        }
        base.startAngle = sa;
        base.endAngle = ea;
      }
      break;
    }

    case "ELLIPSE": {
      const center = e.center as IPoint | undefined;
      const majorEnd = e.majorAxisEndPoint as IPoint | undefined;
      const axisRatio = e.axisRatio as number | undefined;
      if (center && majorEnd) {
        base.center = transformPoint({ x: center.x, y: center.y }, transform);
        // Transform the major axis endpoint relative to center
        const majorTip = transformPoint(
          { x: center.x + majorEnd.x, y: center.y + majorEnd.y },
          transform
        );
        base.majorAxisEnd = {
          x: majorTip.x - base.center.x,
          y: majorTip.y - base.center.y,
        };
        base.axisRatio = axisRatio ?? 1;
        base.startAngle = (e.startAngle as number) ?? 0;
        base.endAngle = (e.endAngle as number) ?? Math.PI * 2;
      }
      break;
    }

    case "SPLINE": {
      // Approximate spline with control points or fit points
      const controlPts = e.controlPoints as IPoint[] | undefined;
      const fitPts = e.fitPoints as IPoint[] | undefined;
      const pts = fitPts?.length ? fitPts : controlPts;
      if (pts && pts.length >= 2) {
        base.vertices = pts.map((v) => transformPoint({ x: v.x, y: v.y }, transform));
        base.splineDegree = (e.degreeOfSplineCurve as number) ?? 3;
      }
      break;
    }

    case "TEXT":
    case "MTEXT": {
      const text = e.text as string | undefined;
      const startPt = e.startPoint as IPoint | undefined;
      const position = e.position as IPoint | undefined;
      const pt = startPt || position;
      if (text && pt) {
        base.text = cleanMTextFormatting(text);
        base.insertionPoint = transformPoint({ x: pt.x, y: pt.y }, transform);
        // Store text height for proper sizing
        const textHeight = (e.textHeight as number) ?? (e.height as number) ?? 0.1;
        base.textHeight = textHeight * Math.abs(transform.sy);
        const rotation = ((e.rotation as number) ?? 0) + transform.rotation;
        base.rotation = rotation;
      }
      break;
    }

    case "SOLID":
    case "3DFACE": {
      // SOLID has 4 corner points
      const pts: Point2D[] = [];
      for (const key of ["corners", "points"]) {
        const corners = e[key] as IPoint[] | undefined;
        if (corners) {
          for (const c of corners) {
            pts.push(transformPoint({ x: c.x, y: c.y }, transform));
          }
        }
      }
      // Try individual point properties
      if (pts.length === 0) {
        for (const key of ["point1", "point2", "point3", "point4"]) {
          const pt = e[key] as IPoint | undefined;
          if (pt) pts.push(transformPoint({ x: pt.x, y: pt.y }, transform));
        }
      }
      if (pts.length >= 3) {
        base.vertices = pts;
        base.closed = true;
      }
      break;
    }

    case "HATCH": {
      // Handled in processEntities via expandHatchBoundaries
      return null;
    }

    case "TRACE": {
      // TRACE is essentially a filled quad, similar to SOLID
      const pts: Point2D[] = [];
      for (const key of ["corners", "points"]) {
        const corners = e[key] as IPoint[] | undefined;
        if (corners) {
          for (const c of corners) {
            pts.push(transformPoint({ x: c.x, y: c.y }, transform));
          }
        }
      }
      if (pts.length === 0) {
        for (const key of ["point1", "point2", "point3", "point4"]) {
          const pt = e[key] as IPoint | undefined;
          if (pt) pts.push(transformPoint({ x: pt.x, y: pt.y }, transform));
        }
      }
      if (pts.length >= 3) {
        base.vertices = pts;
        base.closed = true;
      }
      break;
    }

    case "DIMENSION": {
      base.dimensionType = e.dimensionType as number | undefined;
      base.blockName = e.block as string | undefined;
      const anchor = e.anchorPoint as IPoint | undefined;
      const midText = e.middleOfText as IPoint | undefined;
      if (anchor) {
        base.defPoint1 = transformPoint({ x: anchor.x, y: anchor.y }, transform);
      }
      if (midText) {
        base.textPosition = transformPoint({ x: midText.x, y: midText.y }, transform);
      }
      break;
    }

    case "LEADER": {
      const verts = e.vertices as IPoint[] | undefined;
      if (verts && verts.length >= 2) {
        base.vertices = verts.map((v) => transformPoint({ x: v.x, y: v.y }, transform));
      }
      break;
    }

    case "POINT": {
      const pos = e.position as IPoint | undefined;
      if (pos) {
        base.vertices = [transformPoint({ x: pos.x, y: pos.y }, transform)];
      }
      break;
    }

    case "ATTRIB":
    case "ATTDEF": {
      // Treat attributes like text
      const text = e.text as string | undefined;
      const startPt = e.startPoint as IPoint | undefined;
      if (text && startPt) {
        base.type = "TEXT";
        base.text = text;
        base.insertionPoint = transformPoint({ x: startPt.x, y: startPt.y }, transform);
        const textHeight = (e.textHeight as number) ?? (e.height as number) ?? 0.1;
        base.textHeight = textHeight * Math.abs(transform.sy);
        base.rotation = ((e.rotation as number) ?? 0) + transform.rotation;
      }
      break;
    }

    case "VIEWPORT":
      // Skip viewports
      return null;

    default:
      // Skip unknown entity types
      return null;
  }

  return base;
}

/**
 * Expand HATCH boundary paths into renderable polyline/arc/line entities.
 * We don't render the actual hatch pattern, just the boundary outlines.
 */
function expandHatchBoundaries(
  entity: IEntity,
  transform: Transform,
  result: ParsedEntity[]
): void {
  const e = entity as Record<string, unknown>;
  const boundaryPaths = e.boundaryPaths as Array<Record<string, unknown>> | undefined;
  if (!boundaryPaths) return;

  const color = (e as { colorIndex?: number }).colorIndex ?? (e as { color?: number }).color;
  const layer = entity.layer || "0";

  for (const path of boundaryPaths) {
    // Polyline-type boundaries (type = 2 or has 'point'/'points' array)
    const polyPts = (path.point || path.points) as Array<{ x: number; y: number; bulge?: number }> | undefined;
    if (polyPts && polyPts.length >= 2) {
      const vertices = polyPts.map((p) => transformPoint({ x: p.x, y: p.y }, transform));
      const bulges = polyPts.map((p) => p.bulge ?? 0);
      result.push({
        handle: generateHandle(),
        type: "LWPOLYLINE",
        layer,
        color,
        vertices,
        closed: true,
        bulges: bulges.some((b) => b !== 0) ? bulges : undefined,
      });
      continue;
    }

    // Edge-based boundaries (type = 1 or has 'edges' array)
    const edges = path.edges as Array<Record<string, unknown>> | undefined;
    if (!edges) continue;

    for (const edge of edges) {
      const edgeType = (edge.type as string)?.toUpperCase?.() ?? "";

      if (edgeType === "LINE") {
        const verts = edge.vertices as IPoint[] | undefined;
        if (verts && verts.length >= 2) {
          result.push({
            handle: generateHandle(),
            type: "LINE",
            layer,
            color,
            vertices: verts.map((v) => transformPoint({ x: v.x, y: v.y }, transform)),
          });
        }
      } else if (edgeType === "ARC") {
        const center = edge.center as IPoint | undefined;
        const radius = edge.radius as number | undefined;
        if (center && radius) {
          let sa = (edge.startAngle as number) ?? 0;
          let ea = (edge.endAngle as number) ?? 360;
          sa += transform.rotation;
          ea += transform.rotation;
          result.push({
            handle: generateHandle(),
            type: "ARC",
            layer,
            color,
            center: transformPoint({ x: center.x, y: center.y }, transform),
            radius: radius * Math.abs(transform.sx),
            startAngle: sa,
            endAngle: ea,
          });
        }
      } else if (edgeType === "ELLIPSE") {
        const center = edge.center as IPoint | undefined;
        if (center) {
          const majorEnd = (edge.majorAxisEndPoint || edge.majorAxisEnd) as IPoint | undefined;
          result.push({
            handle: generateHandle(),
            type: "ELLIPSE",
            layer,
            color,
            center: transformPoint({ x: center.x, y: center.y }, transform),
            majorAxisEnd: majorEnd
              ? { x: majorEnd.x * transform.sx, y: majorEnd.y * transform.sy }
              : { x: 1, y: 0 },
            axisRatio: (edge.axisRatio as number) ?? 1,
            startAngle: (edge.startAngle as number) ?? 0,
            endAngle: (edge.endAngle as number) ?? Math.PI * 2,
          });
        }
      } else if (edgeType === "SPLINE") {
        const controlPts = (edge.controlPoints || edge.fitPoints) as IPoint[] | undefined;
        if (controlPts && controlPts.length >= 2) {
          result.push({
            handle: generateHandle(),
            type: "SPLINE",
            layer,
            color,
            vertices: controlPts.map((v) => transformPoint({ x: v.x, y: v.y }, transform)),
            splineDegree: (edge.degree as number) ?? 3,
          });
        }
      }
    }
  }
}

/**
 * Strip MTEXT formatting codes like {\fArial|b0|i0|c0|p34;text}
 */
function cleanMTextFormatting(text: string): string {
  return text
    .replace(/\\[PpNn]/g, "\n") // paragraph breaks
    .replace(/\\[Ff][^;]*;/g, "") // font changes
    .replace(/\\[Hh][^;]*;/g, "") // height changes
    .replace(/\\[Ww][^;]*;/g, "") // width changes
    .replace(/\\[Tt][^;]*;/g, "") // tracking changes
    .replace(/\\[Qq][^;]*;/g, "") // slant changes
    .replace(/\\[Cc]\d+;/g, "") // color changes
    .replace(/\\[Oo]/g, "") // overline toggle
    .replace(/\\[Ll]/g, "") // underline toggle
    .replace(/\\[Kk]/g, "") // strikethrough toggle
    .replace(/\\[Ss][^;]*;/g, "") // stacking
    .replace(/\\[Aa]\d;/g, "") // alignment
    .replace(/\{|\}/g, "") // braces
    .replace(/%%[cCdDpPuU]/g, (m) => {
      // Special symbols
      if (m === "%%c" || m === "%%C") return "\u2300"; // diameter
      if (m === "%%d" || m === "%%D") return "\u00B0"; // degree
      if (m === "%%p" || m === "%%P") return "\u00B1"; // plus-minus
      if (m === "%%u" || m === "%%U") return ""; // underline toggle
      return m;
    })
    .trim();
}

function calculateBounds(entities: ParsedEntity[]): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const entity of entities) {
    const points = getEntityPoints(entity);
    for (const p of points) {
      if (isFinite(p.x) && isFinite(p.y)) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
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

  return points;
}

function detectUnits(dxf: IDxf): string {
  const insunits = dxf.header?.$INSUNITS;
  if (typeof insunits === "number") {
    switch (insunits) {
      case 1: return "inches";
      case 2: return "feet";
      case 4: return "millimeters";
      case 6: return "meters";
      default: return "inches";
    }
  }
  return "inches";
}

let handleCounter = 0;
function generateHandle(): string {
  return `GEN_${(++handleCounter).toString(16).toUpperCase()}`;
}
