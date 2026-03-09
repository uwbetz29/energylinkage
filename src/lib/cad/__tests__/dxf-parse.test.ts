import { describe, it, expect } from "vitest";
import { parseDXF } from "../dxf-parse";
import { MINIMAL_DXF, DXF_WITH_BLOCKS, DXF_WITH_MTEXT } from "./fixtures/sample-dxf-content";

describe("parseDXF", () => {
  it("parses a minimal DXF without errors", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    expect(drawing).toBeDefined();
    expect(drawing.fileName).toBe("test.dxf");
  });

  it("extracts entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    expect(drawing.entities.length).toBeGreaterThan(0);
  });

  it("extracts LINE entities with vertices", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    const lines = drawing.entities.filter((e) => e.type === "LINE");
    expect(lines.length).toBe(2);
    expect(lines[0].vertices).toHaveLength(2);
  });

  it("extracts TEXT entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    const texts = drawing.entities.filter((e) => e.type === "TEXT");
    expect(texts.length).toBe(1);
    expect(texts[0].text).toBe("Hello World");
    expect(texts[0].insertionPoint).toEqual({ x: 50, y: 50 });
  });

  it("extracts CIRCLE entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    const circles = drawing.entities.filter((e) => e.type === "CIRCLE");
    expect(circles.length).toBe(1);
    expect(circles[0].center).toEqual({ x: 50, y: 100 });
    expect(circles[0].radius).toBe(25);
  });

  it("extracts layers", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    expect(drawing.layers.length).toBeGreaterThan(0);
    const testLayer = drawing.layers.find((l) => l.name === "TestLayer");
    expect(testLayer).toBeDefined();
  });

  it("calculates bounds from entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    expect(drawing.bounds.min.x).toBeLessThanOrEqual(0);
    expect(drawing.bounds.max.x).toBeGreaterThanOrEqual(100);
    expect(drawing.bounds.max.y).toBeGreaterThanOrEqual(100);
  });

  it("assigns handles to entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    for (const entity of drawing.entities) {
      expect(entity.handle).toBeTruthy();
    }
  });

  it("assigns layer names to entities", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    for (const entity of drawing.entities) {
      expect(entity.layer).toBeDefined();
    }
  });

  it("detects units from header", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    expect(drawing.units).toBeDefined();
  });

  it("flattens block INSERT references", () => {
    const drawing = parseDXF(DXF_WITH_BLOCKS, "blocks.dxf");
    // The INSERT should be flattened — we should see the LINE from MyBlock
    // transformed by the INSERT's position and scale
    const lines = drawing.entities.filter((e) => e.type === "LINE");
    expect(lines.length).toBeGreaterThanOrEqual(1);
    // The block line goes 0,0 -> 10,0. Insert at 50,50 with scale 2,2
    // So expected: 50,50 -> 70,50
    const insertedLine = lines.find(
      (l) => l.vertices && l.vertices[0].x >= 49
    );
    expect(insertedLine).toBeDefined();
  });

  it("cleans MTEXT formatting codes", () => {
    const drawing = parseDXF(DXF_WITH_MTEXT, "mtext.dxf");
    const mtexts = drawing.entities.filter(
      (e) => e.type === "MTEXT" || e.type === "TEXT"
    );
    expect(mtexts.length).toBeGreaterThanOrEqual(1);
    // The MTEXT had formatting: {\\fArial|b1;\\C1;Hello} World
    // After cleanup should be plain text
    const text = mtexts[0]?.text;
    expect(text).toBeDefined();
    if (text) {
      expect(text).not.toContain("\\f");
      expect(text).not.toContain("\\C");
      expect(text).toContain("Hello");
      expect(text).toContain("World");
    }
  });

  it("initializes components as empty array", () => {
    const drawing = parseDXF(MINIMAL_DXF, "test.dxf");
    // parseDXF does not detect components — that's done separately
    expect(drawing.components).toEqual([]);
  });

  it("handles empty DXF gracefully", () => {
    const emptyDXF = "  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n  0\nEOF\n";
    const drawing = parseDXF(emptyDXF, "empty.dxf");
    expect(drawing.entities).toEqual([]);
  });
});
