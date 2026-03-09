// Type definitions for CAD entities and application state

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}

// Recognized component types in SCR/CO catalyst systems
export type ComponentType =
  | "stack"
  | "silencer"
  | "gas-path"
  | "di-duct"
  | "ta-duct"
  | "dist-grid-duct"
  | "scr-duct"
  | "inside-liner"
  | "nozzle"
  | "platform"
  | "ladder"
  | "unknown";

export interface CADComponent {
  id: string;
  name: string;
  type: ComponentType;
  layerName: string;
  boundingBox: BoundingBox;
  entityHandles: string[];
  dimensions: ComponentDimension[];
  color: string;
}

export interface ComponentDimension {
  id: string;
  label: string;
  value: number; // in inches (internal unit)
  displayValue: string; // formatted as ft-in-fractions
  direction: "horizontal" | "vertical" | "diameter" | "angle";
  entityHandle?: string;
}

export interface ScaleOperation {
  componentId: string;
  componentName: string;
  mode: "linked" | "isolated";
  scaleType: "percentage" | "dimension";
  scaleFactorX: number;
  scaleFactorY: number;
  originalDimensions: ComponentDimension[];
  newDimensions: ComponentDimension[];
  timestamp: Date;
}

export interface DXFLayer {
  name: string;
  color: number;
  visible: boolean;
  frozen: boolean;
  entityCount: number;
}

export interface ParsedDrawing {
  fileName: string;
  layers: DXFLayer[];
  components: CADComponent[];
  entities: ParsedEntity[];
  bounds: BoundingBox;
  units: string;
}

export interface ParsedEntity {
  handle: string;
  type: string;
  layer: string;
  color?: number;
  /** Direct hex color (e.g. "#FF0000") — used for PDF-imported entities */
  colorHex?: string;
  lineWidth?: number;
  vertices?: Point2D[];
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  textHeight?: number;
  insertionPoint?: Point2D;
  blockName?: string;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  closed?: boolean;
  bulges?: number[];
  // For ELLIPSE entities
  majorAxisEnd?: Point2D;
  axisRatio?: number;
  // For SPLINE entities
  splineDegree?: number;
  // For DIMENSION entities
  dimensionType?: number;
  measurementValue?: number;
  textPosition?: Point2D;
  defPoint1?: Point2D;
  defPoint2?: Point2D;
}

// --- Parametric Dimension System ---
// Links dimension text to the geometry it measures, enabling
// "change a value → reshape the drawing" workflow.

export type DimensionDirection = "horizontal" | "vertical" | "aligned" | "radial" | "diameter";

export interface ParametricDimension {
  /** Unique ID for this dimension link */
  id: string;

  /** Handle of the TEXT/MTEXT entity showing the dimension value */
  textHandle: string;

  /** The raw text string displayed (e.g., "45'-0 1/2\"") */
  displayText: string;

  /** Parsed numeric value in drawing units (inches) */
  value: number;

  /** Direction of measurement */
  direction: DimensionDirection;

  /**
   * Handles of geometry entities this dimension measures.
   * For a linear dim: typically the two endpoints or the line(s) it spans.
   * For a radial dim: the arc/circle entity.
   */
  geometryHandles: string[];

  /**
   * The two world-space points defining the measurement span.
   * For linear dims: the extension line endpoints on the measured geometry.
   * For radial dims: center + point on circumference.
   */
  anchorPoints: [Point2D, Point2D];

  /**
   * Handles of entities that form the dimension annotation itself
   * (extension lines, leader lines, arrows, text).
   * These move WITH the dimension but don't define geometry.
   */
  annotationHandles: string[];

  /**
   * Which side of the anchor line expands when the value changes.
   * "both" = symmetric expansion from midpoint.
   * "start" = anchor[0] is fixed, anchor[1] moves.
   * "end" = anchor[1] is fixed, anchor[0] moves.
   */
  expandDirection: "both" | "start" | "end";

  /** Original DIMENSION entity handle (if from DXF), or "pdf-N" for PDF imports */
  sourceHandle?: string;

  /** Confidence score (0-1) of the auto-linking algorithm */
  confidence: number;
}

/** Result of modifying a dimension value */
export interface DimensionModification {
  dimensionId: string;
  oldValue: number;
  newValue: number;
  /** Entity handles that were moved/scaled */
  affectedEntities: string[];
  /** Subset of affectedEntities that were rigidly translated (not deformed) */
  rigidEntities?: string[];
  /** The scale factor applied along the dimension direction */
  scaleFactor: number;
  /** Whether this modification was AI-driven or mechanical fallback */
  source?: "ai" | "mechanical";
  /** AI's reasoning for the resize approach */
  reasoning?: string;
  /** The pivot point used for the resize */
  pivot?: Point2D;
  /** The unit axis direction of the resize */
  axis?: Point2D;
  /** The displacement vector: axis * (newValue - oldValue) */
  displacement?: Point2D;
  /** The OLD position of the moving anchor (non-pivot end) before resize */
  movingAnchorBefore?: Point2D;
}

/** Suggestion for a cascade adjustment after a primary dimension resize */
export interface CascadeSuggestion {
  dimensionId: string;
  displayText: string;
  action: "shift" | "resize";
  /** For shift: the translation vector to apply */
  displacement?: Point2D;
  /** For resize: the suggested new value in inches */
  suggestedNewValue?: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export type ScaleMode = "linked" | "isolated";

export interface ViewerState {
  drawing: ParsedDrawing | null;
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  scaleMode: ScaleMode;
  layerVisibility: Record<string, boolean>;
  zoom: number;
  panOffset: Point2D;
  scaleHistory: ScaleOperation[];
}
