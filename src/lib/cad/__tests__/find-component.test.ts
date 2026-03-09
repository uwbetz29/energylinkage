import { describe, it, expect } from "vitest";
import { findComponentForDimension } from "../find-component";
import type { CADComponent, ParametricDimension } from "@/types/cad";

function makeDim(overrides?: Partial<ParametricDimension>): ParametricDimension {
  return {
    id: "dim-1",
    textHandle: "T1",
    displayText: "10'-0\"",
    value: 120,
    direction: "horizontal",
    geometryHandles: ["L1", "L2"],
    anchorPoints: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ],
    annotationHandles: [],
    expandDirection: "end",
    confidence: 0.9,
    ...overrides,
  };
}

function makeComp(overrides?: Partial<CADComponent>): CADComponent {
  return {
    id: "comp-1",
    name: "Stack",
    type: "stack",
    layerName: "4000 Stack",
    boundingBox: { min: { x: -50, y: 0 }, max: { x: 170, y: 500 } },
    entityHandles: ["L1", "L2", "L3", "L4", "T1"],
    dimensions: [],
    color: "#4A90D9",
    ...overrides,
  };
}

describe("findComponentForDimension", () => {
  it("returns null when no components", () => {
    expect(findComponentForDimension(makeDim(), [])).toBeNull();
  });

  it("finds component by handle overlap", () => {
    const comp = makeComp();
    const dim = makeDim({ geometryHandles: ["L1", "L2"] });

    const result = findComponentForDimension(dim, [comp]);
    expect(result).toBe(comp);
  });

  it("returns component with most overlap when multiple match", () => {
    const comp1 = makeComp({ id: "c1", entityHandles: ["L1"] });
    const comp2 = makeComp({ id: "c2", entityHandles: ["L1", "L2", "T1"] });

    const dim = makeDim({ geometryHandles: ["L1", "L2"], textHandle: "T1" });
    const result = findComponentForDimension(dim, [comp1, comp2]);
    expect(result?.id).toBe("c2");
  });

  it("falls back to spatial containment", () => {
    const comp = makeComp({
      entityHandles: ["X1", "X2"], // no overlap with dim handles
      boundingBox: { min: { x: -100, y: -100 }, max: { x: 200, y: 200 } },
    });

    const dim = makeDim({
      geometryHandles: ["L1"],
      anchorPoints: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
      ],
    });

    const result = findComponentForDimension(dim, [comp]);
    expect(result).toBe(comp);
  });

  it("returns null when dimension is outside all components", () => {
    const comp = makeComp({
      entityHandles: ["X1"],
      boundingBox: { min: { x: 1000, y: 1000 }, max: { x: 2000, y: 2000 } },
    });

    const dim = makeDim({
      geometryHandles: ["L1"],
      anchorPoints: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
      ],
    });

    expect(findComponentForDimension(dim, [comp])).toBeNull();
  });

  it("counts textHandle as overlap", () => {
    const comp1 = makeComp({ id: "c1", entityHandles: ["T1"] }); // has text handle
    const comp2 = makeComp({ id: "c2", entityHandles: ["Z1"] });

    const dim = makeDim({ geometryHandles: ["Z99"], textHandle: "T1" });
    const result = findComponentForDimension(dim, [comp1, comp2]);
    expect(result?.id).toBe("c1");
  });
});
