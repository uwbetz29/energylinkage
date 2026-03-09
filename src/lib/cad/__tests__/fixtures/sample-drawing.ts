import type { ParsedDrawing, ParsedEntity, ParametricDimension, CADComponent } from "@/types/cad";

/** Create a minimal test drawing with configurable overrides */
export function createTestDrawing(overrides?: Partial<ParsedDrawing>): ParsedDrawing {
  const entities: ParsedEntity[] = [
    {
      handle: "L1",
      type: "LINE",
      layer: "4000 Stack",
      vertices: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
      ],
    },
    {
      handle: "L2",
      type: "LINE",
      layer: "4000 Stack",
      vertices: [
        { x: 120, y: 0 },
        { x: 120, y: 540 },
      ],
    },
    {
      handle: "L3",
      type: "LINE",
      layer: "4000 Stack",
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 540 },
      ],
    },
    {
      handle: "T1",
      type: "TEXT",
      layer: "Dimensions",
      text: "10'-0\"",
      insertionPoint: { x: 60, y: -20 },
      textHeight: 6,
    },
    {
      handle: "T2",
      type: "TEXT",
      layer: "Dimensions",
      text: "45'-0\"",
      insertionPoint: { x: 140, y: 270 },
      textHeight: 6,
    },
    {
      handle: "C1",
      type: "CIRCLE",
      layer: "Nozzles",
      center: { x: 60, y: 100 },
      radius: 12,
    },
    {
      handle: "DIM1",
      type: "DIMENSION",
      layer: "Dimensions",
      dimensionType: 0,
      measurementValue: 120,
      textPosition: { x: 60, y: -20 },
      defPoint1: { x: 0, y: 0 },
      defPoint2: { x: 120, y: 0 },
      text: "10'-0\"",
    },
  ];

  const components: CADComponent[] = [
    {
      id: "comp-stack",
      name: "4000 Stack",
      type: "stack",
      layerName: "4000 Stack",
      boundingBox: { min: { x: 0, y: 0 }, max: { x: 120, y: 540 } },
      entityHandles: ["L1", "L2", "L3"],
      dimensions: [
        {
          id: "dim-w",
          label: "Width",
          value: 120,
          displayValue: "10'-0\"",
          direction: "horizontal",
        },
        {
          id: "dim-h",
          label: "Height",
          value: 540,
          displayValue: "45'-0\"",
          direction: "vertical",
        },
      ],
      color: "#FF6B35",
    },
  ];

  return {
    fileName: "test-drawing.dxf",
    layers: [
      { name: "4000 Stack", color: 7, visible: true, frozen: false, entityCount: 3 },
      { name: "Dimensions", color: 1, visible: true, frozen: false, entityCount: 3 },
      { name: "Nozzles", color: 3, visible: true, frozen: false, entityCount: 1 },
    ],
    components,
    entities,
    bounds: { min: { x: 0, y: -20 }, max: { x: 140, y: 540 } },
    units: "inches",
    ...overrides,
  };
}

/** Create a minimal parametric dimension for testing */
export function createTestDimension(overrides?: Partial<ParametricDimension>): ParametricDimension {
  return {
    id: "pdim-1",
    textHandle: "T1",
    displayText: "10'-0\"",
    value: 120,
    direction: "horizontal",
    geometryHandles: ["L1"],
    anchorPoints: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ],
    annotationHandles: [],
    expandDirection: "end",
    confidence: 0.85,
    ...overrides,
  };
}

/** Create a vertical dimension */
export function createVerticalDimension(overrides?: Partial<ParametricDimension>): ParametricDimension {
  return {
    id: "pdim-2",
    textHandle: "T2",
    displayText: "45'-0\"",
    value: 540,
    direction: "vertical",
    geometryHandles: ["L2", "L3"],
    anchorPoints: [
      { x: 120, y: 0 },
      { x: 120, y: 540 },
    ],
    annotationHandles: [],
    expandDirection: "end",
    confidence: 0.9,
    ...overrides,
  };
}
