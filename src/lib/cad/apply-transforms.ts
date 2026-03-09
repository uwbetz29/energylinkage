// Apply AI-returned entity transforms to a drawing (pure function)

import type { ParsedDrawing, ParsedEntity, Point2D } from "@/types/cad";
import type { EntityTransform } from "@/types/ai-resize";

/**
 * Apply an array of entity transforms to a drawing.
 * Returns a new drawing (immutable — original is not modified).
 */
export function applyTransforms(
  drawing: ParsedDrawing,
  transforms: EntityTransform[]
): { drawing: ParsedDrawing; affectedHandles: string[] } {
  const newEntities = drawing.entities.map((e) => structuredClone(e));
  const entityMap = new Map<string, ParsedEntity>();
  for (const e of newEntities) {
    entityMap.set(e.handle, e);
  }

  const affectedHandles: string[] = [];

  for (const transform of transforms) {
    const entity = entityMap.get(transform.handle);
    if (!entity) continue;

    affectedHandles.push(transform.handle);

    switch (transform.op) {
      case "translate":
        translateEntity(entity, transform.dx, transform.dy);
        break;
      case "scale_axis":
        scaleEntityAlongAxis(
          entity,
          transform.pivot,
          transform.axis,
          transform.factor
        );
        break;
      case "set_vertices":
        if (entity.vertices) {
          entity.vertices = transform.vertices.map((v) => ({ x: v.x, y: v.y }));
        }
        break;
    }
  }

  return {
    drawing: { ...drawing, entities: newEntities },
    affectedHandles,
  };
}

function translateEntity(entity: ParsedEntity, dx: number, dy: number): void {
  if (entity.vertices) {
    entity.vertices = entity.vertices.map((v) => ({
      x: v.x + dx,
      y: v.y + dy,
    }));
  }
  if (entity.center) {
    entity.center = { x: entity.center.x + dx, y: entity.center.y + dy };
  }
  if (entity.insertionPoint) {
    entity.insertionPoint = {
      x: entity.insertionPoint.x + dx,
      y: entity.insertionPoint.y + dy,
    };
  }
  if (entity.defPoint1) {
    entity.defPoint1 = { x: entity.defPoint1.x + dx, y: entity.defPoint1.y + dy };
  }
  if (entity.defPoint2) {
    entity.defPoint2 = { x: entity.defPoint2.x + dx, y: entity.defPoint2.y + dy };
  }
  if (entity.textPosition) {
    entity.textPosition = { x: entity.textPosition.x + dx, y: entity.textPosition.y + dy };
  }
}

function scaleEntityAlongAxis(
  entity: ParsedEntity,
  pivot: Point2D,
  axis: Point2D,
  factor: number
): void {
  const scalePoint = (p: Point2D): Point2D => {
    const vx = p.x - pivot.x;
    const vy = p.y - pivot.y;
    const proj = vx * axis.x + vy * axis.y;
    const diff = proj * factor - proj;
    return { x: p.x + diff * axis.x, y: p.y + diff * axis.y };
  };

  if (entity.vertices) {
    entity.vertices = entity.vertices.map(scalePoint);
  }
  if (entity.center) {
    entity.center = scalePoint(entity.center);
  }
  if (entity.radius) {
    entity.radius *= factor;
  }
  if (entity.insertionPoint) {
    entity.insertionPoint = scalePoint(entity.insertionPoint);
  }
  if (entity.defPoint1) {
    entity.defPoint1 = scalePoint(entity.defPoint1);
  }
  if (entity.defPoint2) {
    entity.defPoint2 = scalePoint(entity.defPoint2);
  }
  if (entity.textPosition) {
    entity.textPosition = scalePoint(entity.textPosition);
  }
}

/**
 * Validate that transforms won't produce degenerate results.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateTransforms(
  drawing: ParsedDrawing,
  transforms: EntityTransform[]
): string | null {
  const handleSet = new Set(drawing.entities.map((e) => e.handle));

  for (const t of transforms) {
    if (!handleSet.has(t.handle)) {
      return `Transform references unknown entity handle: ${t.handle}`;
    }
    if (t.op === "scale_axis" && (t.factor <= 0 || !isFinite(t.factor))) {
      return `Invalid scale factor ${t.factor} for entity ${t.handle}`;
    }
    if (t.op === "translate" && (!isFinite(t.dx) || !isFinite(t.dy))) {
      return `Invalid translation for entity ${t.handle}`;
    }
    if (t.op === "set_vertices" && t.vertices.length === 0) {
      return `Empty vertices for entity ${t.handle}`;
    }
  }

  return null;
}
