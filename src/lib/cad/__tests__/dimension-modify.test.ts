import { describe, it, expect } from "vitest";
import { modifyDimension } from "../dimension-modify";
import { createTestDrawing, createTestDimension } from "./fixtures/sample-drawing";

describe("modifyDimension", () => {
  it("scales geometry by newValue", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120 }); // 10'-0"
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240, // 20'-0"
    });
    expect(result.modification.scaleFactor).toBe(2);
    expect(result.modification.oldValue).toBe(120);
    expect(result.modification.newValue).toBe(240);
  });

  it("scales geometry by scalePercent", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120 });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      scalePercent: 150,
    });
    expect(result.modification.scaleFactor).toBe(1.5);
    expect(result.modification.newValue).toBe(180);
  });

  it("updates dimension text with formatted value", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120, textHandle: "T1" });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240,
    });
    const textEntity = result.drawing.entities.find((e) => e.handle === "T1");
    expect(textEntity?.text).toBe("20'-0\"");
  });

  it("updates dimension value in returned dimensions array", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120 });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 180,
    });
    const updatedDim = result.dimensions.find((d) => d.id === dim.id);
    expect(updatedDim?.value).toBe(180);
  });

  it("updates anchor points", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({
      value: 120,
      anchorPoints: [{ x: 0, y: 0 }, { x: 120, y: 0 }],
    });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240,
    });
    const updatedDim = result.dimensions.find((d) => d.id === dim.id);
    // Anchor points should be scaled
    expect(updatedDim?.anchorPoints[1].x).toBeGreaterThan(120);
  });

  it("returns immutable drawing (original unchanged)", () => {
    const drawing = createTestDrawing();
    const originalEntities = [...drawing.entities];
    const dim = createTestDimension({ value: 120 });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240,
    });
    expect(result.drawing).not.toBe(drawing);
    expect(drawing.entities).toEqual(originalEntities);
  });

  it("returns no-op when scale factor is ~1", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120 });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 120.00001, // essentially no change
    });
    expect(result.modification.scaleFactor).toBe(1);
    expect(result.modification.affectedEntities).toHaveLength(0);
  });

  it("throws for unknown dimension ID", () => {
    const drawing = createTestDrawing();
    expect(() =>
      modifyDimension(drawing, [], {
        dimensionId: "nonexistent",
        newValue: 100,
      })
    ).toThrow("not found");
  });

  it("throws for negative scale", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120 });
    expect(() =>
      modifyDimension(drawing, [dim], {
        dimensionId: dim.id,
        newValue: -10,
      })
    ).toThrow(/scale factor|positive/i);
  });

  it("throws when neither newValue nor scalePercent provided", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension();
    expect(() =>
      modifyDimension(drawing, [dim], { dimensionId: dim.id })
    ).toThrow("Must provide");
  });

  it("handles expandDirection: both (symmetric scaling)", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({
      value: 120,
      expandDirection: "both",
      anchorPoints: [{ x: 0, y: 0 }, { x: 120, y: 0 }],
    });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240,
    });
    expect(result.modification.scaleFactor).toBe(2);
  });

  it("records affected entity handles", () => {
    const drawing = createTestDrawing();
    const dim = createTestDimension({ value: 120, geometryHandles: ["L1"], textHandle: "T1" });
    const result = modifyDimension(drawing, [dim], {
      dimensionId: dim.id,
      newValue: 240,
    });
    expect(result.modification.affectedEntities).toContain("L1");
    expect(result.modification.affectedEntities).toContain("T1");
  });
});
