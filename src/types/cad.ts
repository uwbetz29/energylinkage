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
