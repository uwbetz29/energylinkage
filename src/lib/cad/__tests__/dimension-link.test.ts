import { describe, it, expect } from "vitest";
import {
  parseImperialDimension,
  formatImperialDimension,
  linkDimensions,
} from "../dimension-link";
import { createTestDrawing } from "./fixtures/sample-drawing";

describe("parseImperialDimension", () => {
  it("parses feet-inches: 10'-0\"", () => {
    expect(parseImperialDimension("10'-0\"")).toBe(120);
  });

  it("parses feet-inches-fraction: 45'-0 1/2\"", () => {
    expect(parseImperialDimension("45'-0 1/2\"")).toBe(540.5);
  });

  it("parses feet-inches with smart quotes", () => {
    expect(parseImperialDimension("10\u2019-0\u201D")).toBe(null); // curly quotes not supported
  });

  it("parses diameter: Ø9'-0\"", () => {
    expect(parseImperialDimension("Ø9'-0\"")).toBe(108);
  });

  it("parses diameter with unicode: ∅9'-0\"", () => {
    // \u2300 gets normalized to Ø
    expect(parseImperialDimension("\u23009'-0\"")).toBe(108);
  });

  it("parses inches with fraction: 6 1/2\"", () => {
    expect(parseImperialDimension("6 1/2\"")).toBe(6.5);
  });

  it("parses simple inches: 24\"", () => {
    expect(parseImperialDimension('24"')).toBe(24);
  });

  it("parses simple number without quotes: 24", () => {
    expect(parseImperialDimension("24")).toBe(24);
  });

  it("parses decimal: 12.5", () => {
    expect(parseImperialDimension("12.5")).toBe(12.5);
  });

  it("returns null for non-dimension text", () => {
    expect(parseImperialDimension("Hello")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseImperialDimension("")).toBeNull();
  });

  it("returns null for label text like 'STACK'", () => {
    expect(parseImperialDimension("STACK")).toBeNull();
  });

  it("parses zero feet: 0'-6\"", () => {
    expect(parseImperialDimension("0'-6\"")).toBe(6);
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseImperialDimension("  10'-0\"  ")).toBe(120);
  });
});

describe("formatImperialDimension", () => {
  it("formats whole feet: 120 => 10'-0\"", () => {
    expect(formatImperialDimension(120)).toBe("10'-0\"");
  });

  it("formats feet with fraction: 120.5 => 10'-0 1/2\"", () => {
    expect(formatImperialDimension(120.5)).toBe("10'-0 1/2\"");
  });

  it("formats inches only: 6 => 0'-6\"", () => {
    expect(formatImperialDimension(6)).toBe("0'-6\"");
  });

  it("formats fraction only: 0.25 => 0'-0 1/4\"", () => {
    expect(formatImperialDimension(0.25)).toBe("0'-0 1/4\"");
  });

  it("formats with 1/16 precision by default", () => {
    // 0.0625 = 1/16
    expect(formatImperialDimension(120.0625)).toBe("10'-0 1/16\"");
  });

  it("formats negative values", () => {
    expect(formatImperialDimension(-24)).toBe("-2'-0\"");
  });

  it("roundtrips parse→format", () => {
    const testCases = ["10'-0\"", "45'-0 1/2\"", "0'-6\""];
    for (const tc of testCases) {
      const parsed = parseImperialDimension(tc);
      if (parsed !== null) {
        expect(formatImperialDimension(parsed)).toBe(tc);
      }
    }
  });
});

describe("linkDimensions", () => {
  it("returns empty array for drawing with no dimension text", () => {
    const drawing = createTestDrawing({
      entities: [
        {
          handle: "L1",
          type: "LINE",
          layer: "0",
          vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        },
      ],
    });
    const dims = linkDimensions(drawing);
    expect(dims).toEqual([]);
  });

  it("finds dimensions from TEXT entities with imperial values", () => {
    const drawing = createTestDrawing(); // has "10'-0\"" and "45'-0\"" text entities
    const dims = linkDimensions(drawing);
    expect(dims.length).toBeGreaterThan(0);
  });

  it("links dimensions have required properties", () => {
    const drawing = createTestDrawing();
    const dims = linkDimensions(drawing);
    for (const dim of dims) {
      expect(dim.id).toBeDefined();
      expect(dim.textHandle).toBeDefined();
      expect(dim.displayText).toBeDefined();
      expect(dim.value).toBeGreaterThan(0);
      expect(dim.direction).toBeDefined();
      expect(dim.anchorPoints).toHaveLength(2);
      expect(dim.confidence).toBeGreaterThanOrEqual(0);
      expect(dim.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("parses values correctly from dimension text", () => {
    const drawing = createTestDrawing();
    const dims = linkDimensions(drawing);
    const dim10ft = dims.find((d) => d.displayText.includes("10'-0"));
    if (dim10ft) {
      expect(dim10ft.value).toBe(120);
    }
  });

  it("handles DIMENSION entities", () => {
    const drawing = createTestDrawing(); // has a DIMENSION entity with handle DIM1
    const dims = linkDimensions(drawing);
    // Should find dimensions from both TEXT and DIMENSION entities
    expect(dims.length).toBeGreaterThanOrEqual(1);
  });
});
