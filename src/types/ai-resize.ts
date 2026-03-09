// Types for AI-powered dimension resizing

import type { Point2D, ComponentType, DimensionDirection } from "./cad";

// --- Entity transform operations returned by Claude ---

export interface TranslateOp {
  handle: string;
  op: "translate";
  dx: number;
  dy: number;
}

export interface ScaleAxisOp {
  handle: string;
  op: "scale_axis";
  pivot: { x: number; y: number };
  axis: { x: number; y: number };
  factor: number;
}

export interface SetVerticesOp {
  handle: string;
  op: "set_vertices";
  vertices: Array<{ x: number; y: number }>;
}

export type EntityTransform = TranslateOp | ScaleAxisOp | SetVerticesOp;

// --- Request/response for the /api/ai-resize route ---

export interface AIResizeRequest {
  dimension: {
    id: string;
    displayText: string;
    value: number;
    newValue: number;
    direction: DimensionDirection;
    anchorPoints: [Point2D, Point2D];
    expandDirection: "both" | "start" | "end";
    geometryHandles: string[];
    annotationHandles: string[];
    textHandle: string;
  };

  component: {
    name: string;
    type: ComponentType;
    boundingBox: { min: Point2D; max: Point2D };
    entityHandles: string[];
  } | null;

  entities: Array<{
    handle: string;
    type: string;
    layer: string;
    vertices?: Point2D[];
    center?: Point2D;
    radius?: number;
    insertionPoint?: Point2D;
    text?: string;
  }>;

  userInstruction?: string;
}

export interface AIResizeResponse {
  transforms: EntityTransform[];
  reasoning: string;
  source: "ai" | "fallback";
}
