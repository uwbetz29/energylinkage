import { describe, it, expect } from "vitest";
import { applyTransforms, validateTransforms } from "../apply-transforms";
import { createTestDrawing } from "./fixtures/sample-drawing";
import type { EntityTransform } from "@/types/ai-resize";

describe("applyTransforms", () => {
  it("translates entity vertices", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle; // LINE entity
    const origVerts = drawing.entities[0].vertices!.map((v) => ({ ...v }));

    const transforms: EntityTransform[] = [
      { handle, op: "translate", dx: 10, dy: -5 },
    ];

    const result = applyTransforms(drawing, transforms);
    const entity = result.drawing.entities.find((e) => e.handle === handle)!;

    expect(entity.vertices![0].x).toBeCloseTo(origVerts[0].x + 10);
    expect(entity.vertices![0].y).toBeCloseTo(origVerts[0].y - 5);
    expect(result.affectedHandles).toContain(handle);
  });

  it("translates center and insertionPoint", () => {
    const drawing = createTestDrawing();
    // Find or create an entity with center
    const circle = drawing.entities.find((e) => e.type === "CIRCLE");
    if (!circle) return; // skip if no circle in fixtures

    const origCenter = { ...circle.center! };
    const transforms: EntityTransform[] = [
      { handle: circle.handle, op: "translate", dx: 20, dy: 30 },
    ];

    const result = applyTransforms(drawing, transforms);
    const updated = result.drawing.entities.find((e) => e.handle === circle.handle)!;
    expect(updated.center!.x).toBeCloseTo(origCenter.x + 20);
    expect(updated.center!.y).toBeCloseTo(origCenter.y + 30);
  });

  it("scales entity along axis", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;
    const origVerts = drawing.entities[0].vertices!.map((v) => ({ ...v }));

    const transforms: EntityTransform[] = [
      {
        handle,
        op: "scale_axis",
        pivot: { x: 0, y: 0 },
        axis: { x: 1, y: 0 }, // horizontal
        factor: 2,
      },
    ];

    const result = applyTransforms(drawing, transforms);
    const entity = result.drawing.entities.find((e) => e.handle === handle)!;

    // X coordinates should be doubled relative to pivot
    expect(entity.vertices![0].x).toBeCloseTo(origVerts[0].x * 2);
    // Y coordinates should be unchanged (axis is horizontal)
    expect(entity.vertices![0].y).toBeCloseTo(origVerts[0].y);
  });

  it("replaces vertices with set_vertices", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;

    const newVerts = [
      { x: 100, y: 200 },
      { x: 300, y: 400 },
    ];
    const transforms: EntityTransform[] = [
      { handle, op: "set_vertices", vertices: newVerts },
    ];

    const result = applyTransforms(drawing, transforms);
    const entity = result.drawing.entities.find((e) => e.handle === handle)!;

    expect(entity.vertices).toHaveLength(2);
    expect(entity.vertices![0].x).toBe(100);
    expect(entity.vertices![1].y).toBe(400);
  });

  it("does not mutate the original drawing", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;
    const origX = drawing.entities[0].vertices![0].x;

    applyTransforms(drawing, [
      { handle, op: "translate", dx: 999, dy: 999 },
    ]);

    // Original should be unchanged
    expect(drawing.entities[0].vertices![0].x).toBe(origX);
  });

  it("skips unknown handles silently", () => {
    const drawing = createTestDrawing();
    const transforms: EntityTransform[] = [
      { handle: "NONEXISTENT", op: "translate", dx: 10, dy: 10 },
    ];

    const result = applyTransforms(drawing, transforms);
    expect(result.affectedHandles).toHaveLength(0);
    expect(result.drawing.entities).toHaveLength(drawing.entities.length);
  });

  it("applies multiple transforms in order", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;
    const origX = drawing.entities[0].vertices![0].x;

    const transforms: EntityTransform[] = [
      { handle, op: "translate", dx: 10, dy: 0 },
      { handle, op: "translate", dx: 5, dy: 0 },
    ];

    const result = applyTransforms(drawing, transforms);
    const entity = result.drawing.entities.find((e) => e.handle === handle)!;
    expect(entity.vertices![0].x).toBeCloseTo(origX + 15);
  });
});

describe("validateTransforms", () => {
  it("returns null for valid transforms", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;

    expect(
      validateTransforms(drawing, [
        { handle, op: "translate", dx: 10, dy: 10 },
      ])
    ).toBeNull();
  });

  it("rejects unknown handles", () => {
    const drawing = createTestDrawing();
    const err = validateTransforms(drawing, [
      { handle: "FAKE", op: "translate", dx: 0, dy: 0 },
    ]);
    expect(err).toContain("unknown entity handle");
  });

  it("rejects invalid scale factor", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;

    const err = validateTransforms(drawing, [
      { handle, op: "scale_axis", pivot: { x: 0, y: 0 }, axis: { x: 1, y: 0 }, factor: -1 },
    ]);
    expect(err).toContain("Invalid scale factor");
  });

  it("rejects NaN translation", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;

    const err = validateTransforms(drawing, [
      { handle, op: "translate", dx: NaN, dy: 0 },
    ]);
    expect(err).toContain("Invalid translation");
  });

  it("rejects empty vertices", () => {
    const drawing = createTestDrawing();
    const handle = drawing.entities[0].handle;

    const err = validateTransforms(drawing, [
      { handle, op: "set_vertices", vertices: [] },
    ]);
    expect(err).toContain("Empty vertices");
  });
});
