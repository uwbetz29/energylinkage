// Types for AI-powered component recognition and connectivity graph

import type { Point2D } from "./cad";

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

export interface RecognizedComponent {
  id: string;
  type: ComponentType;
  label: string;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  confidence: number;
  dimensionIds: string[];
}

export interface ComponentEdge {
  from: string;
  to: string;
  relationship: "upstream" | "downstream" | "lateral" | "contains";
  sharedBoundary?: "top" | "bottom" | "left" | "right";
}

export type FlowDirection =
  | "left-to-right"
  | "right-to-left"
  | "bottom-to-top"
  | "top-to-bottom";

export interface ComponentGraph {
  components: RecognizedComponent[];
  edges: ComponentEdge[];
  flowDirection: FlowDirection;
}

/** Text label extracted from the drawing for AI consumption */
export interface TextLabel {
  text: string;
  position: Point2D;
  height: number;
}

/** A rectangular region summary for AI consumption */
export interface Region {
  id: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  entityCount: number;
  dominantTypes: string[];
}

/** Dimension summary for AI consumption */
export interface DimSummary {
  id: string;
  displayText: string;
  valueInches: number;
  midpoint: Point2D;
  direction: string;
}

/** Shape of the geometry summary sent to the AI */
export interface GeometrySummary {
  textLabels: TextLabel[];
  regions: Region[];
  dimensionSummary: DimSummary[];
}
