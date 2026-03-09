import { describe, it, expect } from "vitest";
import { scaleComponent, type ScaleParams } from "../geometry-scaler";
import { createTestDrawing } from "./fixtures/sample-drawing";

describe("scaleComponent", () => {
  describe("percentage mode", () => {
    it("scales all entities by uniform percentage", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 200, // 2x
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      // Bounding box width should double (centered around ref point)
      const origWidth = 120; // max.x - min.x
      const newWidth = comp.boundingBox.max.x - comp.boundingBox.min.x;
      expect(newWidth).toBeCloseTo(origWidth * 2);
    });

    it("scales dimensions values proportionally", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 150,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      // Original width dim = 120, height dim = 540
      const widthDim = comp.dimensions.find((d) => d.label === "Width")!;
      const heightDim = comp.dimensions.find((d) => d.label === "Height")!;
      expect(widthDim.value).toBeCloseTo(180); // 120 * 1.5
      expect(heightDim.value).toBeCloseTo(810); // 540 * 1.5
    });
  });

  describe("dimension mode", () => {
    it("scales component when a dimension value changes", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "dimension",
        dimensionId: "dim-w",
        newDimensionValue: "20'-0\"", // 240 inches, was 120
        uniformScale: true,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      const widthDim = comp.dimensions.find((d) => d.label === "Width")!;
      expect(widthDim.value).toBeCloseTo(240);
    });

    it("applies non-uniform horizontal scale when uniformScale is false", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "dimension",
        dimensionId: "dim-w",
        newDimensionValue: "20'-0\"",
        uniformScale: false,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      const widthDim = comp.dimensions.find((d) => d.label === "Width")!;
      const heightDim = comp.dimensions.find((d) => d.label === "Height")!;
      expect(widthDim.value).toBeCloseTo(240);
      // Height stays the same in non-uniform horizontal scale
      expect(heightDim.value).toBeCloseTo(540);
    });

    it("applies non-uniform vertical scale when uniformScale is false", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "dimension",
        dimensionId: "dim-h",
        newDimensionValue: "90'-0\"", // 1080 inches, was 540
        uniformScale: false,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      const widthDim = comp.dimensions.find((d) => d.label === "Width")!;
      const heightDim = comp.dimensions.find((d) => d.label === "Height")!;
      // Width stays same, height doubles
      expect(widthDim.value).toBeCloseTo(120);
      expect(heightDim.value).toBeCloseTo(1080);
    });
  });

  describe("explicit scale overrides", () => {
    it("uses scaleX and scaleY when provided", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 100,
        scaleX: 3,
        scaleY: 1,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");
      const comp = result.components.find((c) => c.id === "comp-stack")!;

      const widthDim = comp.dimensions.find((d) => d.label === "Width")!;
      const heightDim = comp.dimensions.find((d) => d.label === "Height")!;
      expect(widthDim.value).toBeCloseTo(360); // 120 * 3
      expect(heightDim.value).toBeCloseTo(540); // 540 * 1
    });
  });

  describe("immutability", () => {
    it("does not mutate the original drawing", () => {
      const drawing = createTestDrawing();
      const origStr = JSON.stringify(drawing);
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 200,
      };

      scaleComponent(drawing, params, "isolated");
      expect(JSON.stringify(drawing)).toBe(origStr);
    });
  });

  describe("entity scaling", () => {
    it("scales vertex positions relative to component center", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 200,
      };

      const { drawing: result } = scaleComponent(drawing, params, "isolated");

      // L1 was from (0,0) to (120,0). Component center is (60,270).
      // Scaled by 2x from center:
      // (0,0) -> 60 + (0-60)*2, 270 + (0-270)*2 = (-60, -270)
      // (120,0) -> 60 + (120-60)*2, 270 + (0-270)*2 = (180, -270)
      const l1 = result.entities.find((e) => e.handle === "L1")!;
      expect(l1.vertices![0].x).toBeCloseTo(-60);
      expect(l1.vertices![0].y).toBeCloseTo(-270);
      expect(l1.vertices![1].x).toBeCloseTo(180);
      expect(l1.vertices![1].y).toBeCloseTo(-270);
    });

    it("scales circle radius by average of scaleX and scaleY", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 100,
        scaleX: 2,
        scaleY: 4,
      };

      // C1 is on layer "Nozzles", not in the comp-stack entityHandles
      // So let's add it to comp-stack for this test
      const drawingWithCircle = createTestDrawing({
        components: [
          {
            ...drawing.components[0],
            entityHandles: ["L1", "L2", "L3", "C1"],
          },
        ],
      });

      const { drawing: result } = scaleComponent(
        drawingWithCircle,
        params,
        "isolated"
      );
      const c1 = result.entities.find((e) => e.handle === "C1")!;
      // Original radius = 12, average scale = (2+4)/2 = 3
      expect(c1.radius).toBeCloseTo(36);
    });
  });

  describe("linked mode", () => {
    it("shifts neighbors when component is scaled", () => {
      // Create a drawing with two stacked components
      const drawing = createTestDrawing({
        components: [
          {
            id: "comp-lower",
            name: "Lower",
            type: "gas-path",
            layerName: "Lower",
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 120, y: 200 } },
            entityHandles: ["L1"],
            dimensions: [
              {
                id: "dim-lh",
                label: "Height",
                value: 200,
                displayValue: "16'-8\"",
                direction: "vertical",
              },
            ],
            color: "#D9A04A",
          },
          {
            id: "comp-upper",
            name: "Upper",
            type: "stack",
            layerName: "Upper",
            boundingBox: { min: { x: 0, y: 200 }, max: { x: 120, y: 500 } },
            entityHandles: ["L2"],
            dimensions: [],
            color: "#4A90D9",
          },
        ],
      });

      const params: ScaleParams = {
        componentId: "comp-lower",
        scaleType: "percentage",
        scalePercent: 150, // 1.5x
      };

      const { drawing: result } = scaleComponent(drawing, params, "linked");
      const upper = result.components.find((c) => c.id === "comp-upper")!;

      // Lower comp center Y = 100, scaled 1.5x
      // New max Y = 100 + (200-100)*1.5 = 250
      // deltaMaxY = 250 - 200 = 50
      // Upper should shift up by 50
      expect(upper.boundingBox.min.y).toBeCloseTo(250);
    });
  });

  describe("operation record", () => {
    it("returns a complete ScaleOperation", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "comp-stack",
        scaleType: "percentage",
        scalePercent: 125,
      };

      const { operation } = scaleComponent(drawing, params, "isolated");
      expect(operation.componentId).toBe("comp-stack");
      expect(operation.componentName).toBe("4000 Stack");
      expect(operation.mode).toBe("isolated");
      expect(operation.scaleType).toBe("percentage");
      expect(operation.scaleFactorX).toBeCloseTo(1.25);
      expect(operation.scaleFactorY).toBeCloseTo(1.25);
      expect(operation.originalDimensions).toHaveLength(2);
      expect(operation.newDimensions).toHaveLength(2);
      expect(operation.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("error handling", () => {
    it("throws when component is not found", () => {
      const drawing = createTestDrawing();
      const params: ScaleParams = {
        componentId: "nonexistent",
        scaleType: "percentage",
        scalePercent: 100,
      };

      expect(() => scaleComponent(drawing, params, "isolated")).toThrow(
        "Component nonexistent not found"
      );
    });
  });
});
