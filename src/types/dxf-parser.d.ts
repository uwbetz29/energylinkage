// Type declarations for the dxf-parser package
declare module "dxf-parser" {
  export interface DXFEntity {
    type: string;
    handle?: string;
    layer?: string;
    colorIndex?: number;
    color?: number;
    lineType?: string;
    lineWeight?: number;
    // LINE
    vertices?: Array<{ x: number; y: number; z?: number }>;
    // CIRCLE / ARC
    center?: { x: number; y: number; z?: number };
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    // TEXT / MTEXT
    text?: string;
    startPoint?: { x: number; y: number; z?: number };
    endPoint?: { x: number; y: number; z?: number };
    textHeight?: number;
    rotation?: number;
    // INSERT (block reference)
    name?: string;
    position?: { x: number; y: number; z?: number };
    xScale?: number;
    yScale?: number;
    zScale?: number;
    // DIMENSION
    dimensionType?: number;
    block?: string;
    anchorPoint?: { x: number; y: number; z?: number };
    middleOfText?: { x: number; y: number; z?: number };
    // LWPOLYLINE
    shape?: boolean;
    // POLYLINE
    is3dPolyline?: boolean;
    includesCurveFitVertices?: boolean;
    includesSplineFitVertices?: boolean;
    // HATCH
    boundaryPaths?: Array<{
      edges?: Array<{
        type: number;
        vertices?: Array<{ x: number; y: number }>;
        center?: { x: number; y: number };
        radius?: number;
        startAngle?: number;
        endAngle?: number;
      }>;
    }>;
    // ELLIPSE
    majorAxisEndPoint?: { x: number; y: number; z?: number };
    axisRatio?: number;
    // SPLINE
    controlPoints?: Array<{ x: number; y: number; z?: number }>;
    fitPoints?: Array<{ x: number; y: number; z?: number }>;
    degreeOfSplineCurve?: number;
    numberOfKnots?: number;
    knotValues?: number[];
    // Generic
    extendedData?: Record<string, unknown>;
    ownerHandle?: string;
  }

  export interface DXFBlock {
    name: string;
    handle?: string;
    layer?: string;
    position?: { x: number; y: number; z?: number };
    entities?: DXFEntity[];
    name2?: string;
    xrefPath?: string;
  }

  export interface DXFLayer {
    name: string;
    visible?: boolean;
    frozen?: boolean;
    colorIndex?: number;
    color?: number;
    lineType?: string;
  }

  export interface DXFTable {
    layer?: Record<string, DXFLayer>;
    lineType?: Record<string, unknown>;
    viewPort?: Record<string, unknown>;
    dimStyle?: Record<string, unknown>;
    style?: Record<string, unknown>;
    blockRecord?: Record<string, unknown>;
  }

  export interface DXFHeader {
    [key: string]: unknown;
  }

  export interface DXFOutput {
    header?: DXFHeader;
    tables?: DXFTable;
    blocks?: Record<string, DXFBlock>;
    entities?: DXFEntity[];
  }

  export default class DxfParser {
    parseSync(dxfContent: string): DXFOutput;
    parse(dxfContent: string): Promise<DXFOutput>;
  }
}
