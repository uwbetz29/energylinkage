// Geometry scaling engine — scales component entities and updates dimensions
import type {
  ParsedDrawing,
  ParsedEntity,
  CADComponent,
  ScaleOperation,
  ComponentDimension,
  Point2D,
} from "@/types/cad";
import { inchesToImperial, parseImperialToInches } from "./units";

export interface ScaleParams {
  componentId: string;
  scaleType: "percentage" | "dimension";
  // For percentage mode
  scalePercent?: number; // e.g., 110 for 10% larger
  // For dimension mode
  dimensionId?: string;
  newDimensionValue?: string; // imperial format e.g., "45'-0\""
  // Scale axis
  uniformScale?: boolean; // true = scale both X and Y equally
  scaleX?: number; // override X scale factor
  scaleY?: number; // override Y scale factor
}

/**
 * Scale a component's geometry and return the modified drawing
 */
export function scaleComponent(
  drawing: ParsedDrawing,
  params: ScaleParams,
  mode: "linked" | "isolated"
): { drawing: ParsedDrawing; operation: ScaleOperation } {
  const component = drawing.components.find(
    (c) => c.id === params.componentId
  );
  if (!component) {
    throw new Error(`Component ${params.componentId} not found`);
  }

  // Calculate scale factors
  let scaleFactorX = 1;
  let scaleFactorY = 1;

  if (params.scaleType === "percentage" && params.scalePercent) {
    const factor = params.scalePercent / 100;
    scaleFactorX = factor;
    scaleFactorY = factor;
  } else if (
    params.scaleType === "dimension" &&
    params.dimensionId &&
    params.newDimensionValue
  ) {
    const dim = component.dimensions.find(
      (d) => d.id === params.dimensionId
    );
    if (dim) {
      const newValueInches = parseImperialToInches(params.newDimensionValue);
      const factor = dim.value !== 0 ? newValueInches / dim.value : 1;
      if (dim.direction === "horizontal") {
        scaleFactorX = factor;
        scaleFactorY = params.uniformScale !== false ? factor : 1;
      } else if (dim.direction === "vertical") {
        scaleFactorY = factor;
        scaleFactorX = params.uniformScale !== false ? factor : 1;
      } else {
        scaleFactorX = factor;
        scaleFactorY = factor;
      }
    }
  }

  // Override with explicit scale factors if provided
  if (params.scaleX !== undefined) scaleFactorX = params.scaleX;
  if (params.scaleY !== undefined) scaleFactorY = params.scaleY;

  // Calculate reference point (center of component bounding box)
  const refPoint: Point2D = {
    x: (component.boundingBox.min.x + component.boundingBox.max.x) / 2,
    y: (component.boundingBox.min.y + component.boundingBox.max.y) / 2,
  };

  // Clone the drawing
  const newDrawing = structuredClone(drawing);

  // Get entity handles for this component
  const handleSet = new Set(component.entityHandles);

  // Scale the component's entities
  for (const entity of newDrawing.entities) {
    if (handleSet.has(entity.handle)) {
      scaleEntity(entity, refPoint, scaleFactorX, scaleFactorY);
    }
  }

  // Update component bounding box
  const newComponent = newDrawing.components.find(
    (c) => c.id === params.componentId
  )!;
  newComponent.boundingBox = {
    min: {
      x: refPoint.x + (component.boundingBox.min.x - refPoint.x) * scaleFactorX,
      y: refPoint.y + (component.boundingBox.min.y - refPoint.y) * scaleFactorY,
    },
    max: {
      x: refPoint.x + (component.boundingBox.max.x - refPoint.x) * scaleFactorX,
      y: refPoint.y + (component.boundingBox.max.y - refPoint.y) * scaleFactorY,
    },
  };

  // Update dimensions
  const newDimensions: ComponentDimension[] = newComponent.dimensions.map(
    (dim) => {
      const scaleFactor =
        dim.direction === "horizontal" ? scaleFactorX : scaleFactorY;
      const newValue = dim.value * scaleFactor;
      return {
        ...dim,
        value: newValue,
        displayValue: inchesToImperial(newValue),
      };
    }
  );
  newComponent.dimensions = newDimensions;

  // In linked mode, shift neighboring components
  if (mode === "linked") {
    shiftNeighbors(
      newDrawing,
      component,
      newComponent,
      scaleFactorX,
      scaleFactorY,
      refPoint
    );
  }

  // Build operation record
  const operation: ScaleOperation = {
    componentId: params.componentId,
    componentName: component.name,
    mode,
    scaleType: params.scaleType,
    scaleFactorX,
    scaleFactorY,
    originalDimensions: component.dimensions,
    newDimensions,
    timestamp: new Date(),
  };

  return { drawing: newDrawing, operation };
}

function scaleEntity(
  entity: ParsedEntity,
  refPoint: Point2D,
  scaleX: number,
  scaleY: number
): void {
  // Scale vertices
  if (entity.vertices) {
    for (const v of entity.vertices) {
      v.x = refPoint.x + (v.x - refPoint.x) * scaleX;
      v.y = refPoint.y + (v.y - refPoint.y) * scaleY;
    }
  }

  // Scale center point
  if (entity.center) {
    entity.center.x = refPoint.x + (entity.center.x - refPoint.x) * scaleX;
    entity.center.y = refPoint.y + (entity.center.y - refPoint.y) * scaleY;
  }

  // Scale radius (use average of X/Y for non-uniform scaling)
  if (entity.radius) {
    entity.radius *= (scaleX + scaleY) / 2;
  }

  // Scale insertion point
  if (entity.insertionPoint) {
    entity.insertionPoint.x =
      refPoint.x + (entity.insertionPoint.x - refPoint.x) * scaleX;
    entity.insertionPoint.y =
      refPoint.y + (entity.insertionPoint.y - refPoint.y) * scaleY;
  }

  // Scale dimension points
  if (entity.defPoint1) {
    entity.defPoint1.x =
      refPoint.x + (entity.defPoint1.x - refPoint.x) * scaleX;
    entity.defPoint1.y =
      refPoint.y + (entity.defPoint1.y - refPoint.y) * scaleY;
  }
  if (entity.defPoint2) {
    entity.defPoint2.x =
      refPoint.x + (entity.defPoint2.x - refPoint.x) * scaleX;
    entity.defPoint2.y =
      refPoint.y + (entity.defPoint2.y - refPoint.y) * scaleY;
  }
  if (entity.textPosition) {
    entity.textPosition.x =
      refPoint.x + (entity.textPosition.x - refPoint.x) * scaleX;
    entity.textPosition.y =
      refPoint.y + (entity.textPosition.y - refPoint.y) * scaleY;
  }

  // Update text for dimension entities
  if (entity.type === "DIMENSION" && entity.measurementValue) {
    // Recalculate from new defPoints
    if (entity.defPoint1 && entity.defPoint2) {
      const dx = entity.defPoint2.x - entity.defPoint1.x;
      const dy = entity.defPoint2.y - entity.defPoint1.y;
      entity.measurementValue = Math.sqrt(dx * dx + dy * dy);
      entity.text = inchesToImperial(entity.measurementValue);
    }
  }
}

/**
 * In linked mode, shift neighboring components when one is resized
 */
function shiftNeighbors(
  drawing: ParsedDrawing,
  originalComponent: CADComponent,
  newComponent: CADComponent,
  _scaleX: number,
  _scaleY: number,
  _refPoint: Point2D
): void {
  // Calculate how much the component bounds changed
  const deltaMinX =
    newComponent.boundingBox.min.x - originalComponent.boundingBox.min.x;
  const deltaMaxX =
    newComponent.boundingBox.max.x - originalComponent.boundingBox.max.x;
  const deltaMinY =
    newComponent.boundingBox.min.y - originalComponent.boundingBox.min.y;
  const deltaMaxY =
    newComponent.boundingBox.max.y - originalComponent.boundingBox.max.y;

  // Find components that are adjacent
  for (const comp of drawing.components) {
    if (comp.id === newComponent.id) continue;

    const compHandles = new Set(comp.entityHandles);
    let shiftX = 0;
    let shiftY = 0;

    // Component is above the scaled one
    if (comp.boundingBox.min.y >= originalComponent.boundingBox.max.y - 1) {
      shiftY = deltaMaxY;
    }
    // Component is below
    else if (comp.boundingBox.max.y <= originalComponent.boundingBox.min.y + 1) {
      shiftY = deltaMinY;
    }
    // Component is to the right
    if (comp.boundingBox.min.x >= originalComponent.boundingBox.max.x - 1) {
      shiftX = deltaMaxX;
    }
    // Component is to the left
    else if (comp.boundingBox.max.x <= originalComponent.boundingBox.min.x + 1) {
      shiftX = deltaMinX;
    }

    if (shiftX !== 0 || shiftY !== 0) {
      // Shift all entities in this neighbor component
      for (const entity of drawing.entities) {
        if (compHandles.has(entity.handle)) {
          shiftEntity(entity, shiftX, shiftY);
        }
      }

      // Update neighbor bounding box
      comp.boundingBox.min.x += shiftX;
      comp.boundingBox.max.x += shiftX;
      comp.boundingBox.min.y += shiftY;
      comp.boundingBox.max.y += shiftY;
    }
  }
}

function shiftEntity(entity: ParsedEntity, dx: number, dy: number): void {
  if (entity.vertices) {
    for (const v of entity.vertices) {
      v.x += dx;
      v.y += dy;
    }
  }
  if (entity.center) {
    entity.center.x += dx;
    entity.center.y += dy;
  }
  if (entity.insertionPoint) {
    entity.insertionPoint.x += dx;
    entity.insertionPoint.y += dy;
  }
  if (entity.defPoint1) {
    entity.defPoint1.x += dx;
    entity.defPoint1.y += dy;
  }
  if (entity.defPoint2) {
    entity.defPoint2.x += dx;
    entity.defPoint2.y += dy;
  }
  if (entity.textPosition) {
    entity.textPosition.x += dx;
    entity.textPosition.y += dy;
  }
}
