import { describe, it, expect } from "vitest";
import { detectComponents } from "../component-detector";
import type { ParsedDrawing, ParsedEntity } from "@/types/cad";

function makeEntity(overrides: Partial<ParsedEntity>): ParsedEntity {
  return {
    handle: "E1",
    type: "LINE",
    layer: "0",
    ...overrides,
  };
}

function makeDrawing(
  entities: ParsedEntity[],
  overrides?: Partial<ParsedDrawing>
): ParsedDrawing {
  return {
    fileName: "test.dxf",
    layers: [],
    components: [],
    entities,
    bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
    units: "inches",
    ...overrides,
  };
}

describe("detectComponents", () => {
  describe("layer pattern matching", () => {
    it("detects a Stack component from layer name", () => {
      const entities = [
        makeEntity({ handle: "E1", layer: "4000 Stack", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
        makeEntity({ handle: "E2", layer: "4000 Stack", vertices: [{ x: 100, y: 0 }, { x: 100, y: 200 }] }),
      ];
      const drawing = makeDrawing(entities);
      const components = detectComponents(drawing);

      expect(components.length).toBeGreaterThanOrEqual(1);
      const stack = components.find((c) => c.type === "stack");
      expect(stack).toBeDefined();
      expect(stack!.name).toBe("Stack");
      expect(stack!.entityHandles).toContain("E1");
      expect(stack!.entityHandles).toContain("E2");
    });

    it("detects a Silencer component", () => {
      const entities = [
        makeEntity({ handle: "S1", layer: "Silencer Section", vertices: [{ x: 0, y: 0 }, { x: 50, y: 50 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const silencer = components.find((c) => c.type === "silencer");
      expect(silencer).toBeDefined();
      expect(silencer!.name).toBe("Silencer");
    });

    it("detects a Nozzle component", () => {
      const entities = [
        makeEntity({ handle: "N1", layer: "Nozzles", center: { x: 50, y: 50 }, radius: 10, type: "CIRCLE" }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const nozzle = components.find((c) => c.type === "nozzle");
      expect(nozzle).toBeDefined();
    });

    it("detects SCR Duct from layer name", () => {
      const entities = [
        makeEntity({ handle: "SD1", layer: "SCR Duct", vertices: [{ x: 0, y: 0 }, { x: 100, y: 100 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const scrDuct = components.find((c) => c.type === "scr-duct");
      expect(scrDuct).toBeDefined();
    });

    it("detects D.I. Duct (case-insensitive)", () => {
      const entities = [
        makeEntity({ handle: "DI1", layer: "D.I. Duct", vertices: [{ x: 0, y: 0 }, { x: 80, y: 0 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const diDuct = components.find((c) => c.type === "di-duct");
      expect(diDuct).toBeDefined();
    });

    it("assigns correct color per component type", () => {
      const entities = [
        makeEntity({ handle: "E1", layer: "Stack Top", vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));
      const stack = components.find((c) => c.type === "stack");
      expect(stack!.color).toBe("#4A90D9");
    });

    it("detects multiple components from different layers", () => {
      const entities = [
        makeEntity({ handle: "E1", layer: "4000 Stack", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
        makeEntity({ handle: "E2", layer: "Silencer", vertices: [{ x: 0, y: 100 }, { x: 100, y: 100 }] }),
        makeEntity({ handle: "E3", layer: "Gas Path", vertices: [{ x: 0, y: 200 }, { x: 100, y: 200 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const types = components.map((c) => c.type);
      expect(types).toContain("stack");
      expect(types).toContain("silencer");
      expect(types).toContain("gas-path");
    });
  });

  describe("bounding box calculation", () => {
    it("calculates correct bounding box from entity vertices", () => {
      const entities = [
        makeEntity({ handle: "E1", layer: "Stack", vertices: [{ x: 10, y: 20 }, { x: 90, y: 30 }] }),
        makeEntity({ handle: "E2", layer: "Stack", vertices: [{ x: 50, y: 5 }, { x: 60, y: 80 }] }),
      ];
      const components = detectComponents(makeDrawing(entities));
      const stack = components.find((c) => c.type === "stack")!;

      expect(stack.boundingBox.min.x).toBe(10);
      expect(stack.boundingBox.min.y).toBe(5);
      expect(stack.boundingBox.max.x).toBe(90);
      expect(stack.boundingBox.max.y).toBe(80);
    });

    it("includes circle extents in bounds", () => {
      const entities = [
        makeEntity({
          handle: "C1", layer: "Nozzles", type: "CIRCLE",
          center: { x: 50, y: 50 }, radius: 20,
        }),
      ];
      const components = detectComponents(makeDrawing(entities));
      const nozzle = components.find((c) => c.type === "nozzle")!;

      expect(nozzle.boundingBox.min.x).toBe(30);
      expect(nozzle.boundingBox.min.y).toBe(30);
      expect(nozzle.boundingBox.max.x).toBe(70);
      expect(nozzle.boundingBox.max.y).toBe(70);
    });
  });

  describe("dimension extraction", () => {
    it("extracts DIMENSION entities into component dimensions", () => {
      const entities = [
        makeEntity({
          handle: "D1", layer: "Stack", type: "DIMENSION",
          dimensionType: 0,
          defPoint1: { x: 0, y: 0 },
          defPoint2: { x: 120, y: 0 },
          text: "10'-0\"",
          measurementValue: 120,
        }),
      ];
      const components = detectComponents(makeDrawing(entities));
      const stack = components.find((c) => c.type === "stack")!;

      expect(stack.dimensions.length).toBeGreaterThanOrEqual(1);
      const dim = stack.dimensions[0];
      expect(dim.direction).toBe("horizontal");
      expect(dim.value).toBeCloseTo(120);
    });
  });

  describe("text label fallback (Strategy 2)", () => {
    it("detects components from text labels when no layer matches", () => {
      const entities = [
        makeEntity({
          handle: "T1", layer: "Annotations", type: "TEXT",
          text: "4000 STACK",
          insertionPoint: { x: 50, y: 50 },
        }),
        makeEntity({
          handle: "L1", layer: "Annotations",
          vertices: [{ x: 40, y: 40 }, { x: 60, y: 60 }],
        }),
      ];
      const components = detectComponents(makeDrawing(entities));

      const stack = components.find((c) => c.type === "stack");
      expect(stack).toBeDefined();
      expect(stack!.name).toBe("4000 Stack");
    });
  });

  describe("spatial fallback (Strategy 3)", () => {
    it("creates spatial regions when no components found", () => {
      const entities = [
        makeEntity({
          handle: "E1", layer: "RandomLayer",
          vertices: [{ x: 10, y: 10 }, { x: 90, y: 90 }],
        }),
      ];
      const drawing = makeDrawing(entities, {
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
      });
      const components = detectComponents(drawing);

      expect(components.length).toBe(2);
      expect(components[0].name).toBe("Upper Section");
      expect(components[1].name).toBe("Lower Section");
    });
  });
});
