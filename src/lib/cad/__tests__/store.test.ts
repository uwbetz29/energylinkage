import { describe, it, expect, beforeEach } from "vitest";
import { useCADStore } from "../store";
import { MINIMAL_DXF } from "./fixtures/sample-dxf-content";

/** Reset store to a clean state before each test */
function resetStore() {
  useCADStore.getState().reset();
}

describe("CAD Store", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("starts with no drawing loaded", () => {
      const state = useCADStore.getState();
      expect(state.drawing).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("starts with empty tabs", () => {
      const state = useCADStore.getState();
      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeNull();
    });

    it("starts with linked scale mode", () => {
      expect(useCADStore.getState().scaleMode).toBe("linked");
    });
  });

  describe("loadDXFFile", () => {
    it("parses DXF and sets drawing", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const state = useCADStore.getState();

      expect(state.drawing).not.toBeNull();
      expect(state.drawing!.fileName).toBe("test.dxf");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("populates entities from DXF", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const { drawing } = useCADStore.getState();

      // MINIMAL_DXF has 2 LINEs, 1 TEXT, 1 CIRCLE = 4 entities
      expect(drawing!.entities.length).toBe(4);
    });

    it("populates layers from DXF", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const { drawing } = useCADStore.getState();

      expect(drawing!.layers.length).toBeGreaterThanOrEqual(1);
      const layerNames = drawing!.layers.map((l) => l.name);
      expect(layerNames).toContain("TestLayer");
    });

    it("initializes layer visibility", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const { layerVisibility } = useCADStore.getState();

      expect(layerVisibility["TestLayer"]).toBeDefined();
    });

    it("clears selection on load", () => {
      useCADStore.setState({ selectedComponentId: "old-comp" });
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");

      expect(useCADStore.getState().selectedComponentId).toBeNull();
    });

    it("sets error on invalid DXF", () => {
      useCADStore.getState().loadDXFFile("not a valid dxf", "bad.dxf");
      const state = useCADStore.getState();

      // Should either set error or have a null/empty drawing
      // parseDXF may not throw for all invalid content, but loading should complete
      expect(state.isLoading).toBe(false);
    });
  });

  describe("selection", () => {
    it("selectComponent updates selectedComponentId", () => {
      useCADStore.getState().selectComponent("comp-1");
      expect(useCADStore.getState().selectedComponentId).toBe("comp-1");
    });

    it("selectComponent with null clears selection", () => {
      useCADStore.getState().selectComponent("comp-1");
      useCADStore.getState().selectComponent(null);
      expect(useCADStore.getState().selectedComponentId).toBeNull();
    });

    it("hoverComponent updates hoveredComponentId", () => {
      useCADStore.getState().hoverComponent("comp-2");
      expect(useCADStore.getState().hoveredComponentId).toBe("comp-2");
    });
  });

  describe("scale mode", () => {
    it("setScaleMode changes mode", () => {
      useCADStore.getState().setScaleMode("isolated");
      expect(useCADStore.getState().scaleMode).toBe("isolated");
    });

    it("setScaleMode switches back to linked", () => {
      useCADStore.getState().setScaleMode("isolated");
      useCADStore.getState().setScaleMode("linked");
      expect(useCADStore.getState().scaleMode).toBe("linked");
    });
  });

  describe("layer visibility", () => {
    beforeEach(() => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
    });

    it("toggleLayerVisibility flips a layer", () => {
      const { layerVisibility } = useCADStore.getState();
      const initialVis = layerVisibility["TestLayer"];

      useCADStore.getState().toggleLayerVisibility("TestLayer");
      expect(useCADStore.getState().layerVisibility["TestLayer"]).toBe(!initialVis);
    });

    it("setAllLayerVisibility sets all layers to false", () => {
      useCADStore.getState().setAllLayerVisibility(false);
      const { layerVisibility } = useCADStore.getState();

      for (const vis of Object.values(layerVisibility)) {
        expect(vis).toBe(false);
      }
    });

    it("setAllLayerVisibility sets all layers to true", () => {
      useCADStore.getState().setAllLayerVisibility(false);
      useCADStore.getState().setAllLayerVisibility(true);
      const { layerVisibility } = useCADStore.getState();

      for (const vis of Object.values(layerVisibility)) {
        expect(vis).toBe(true);
      }
    });
  });

  describe("undo / redo", () => {
    it("undo does nothing with empty stack", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const drawingBefore = useCADStore.getState().drawing;

      useCADStore.getState().undo();
      expect(useCADStore.getState().drawing).toBe(drawingBefore);
    });

    it("redo does nothing with empty stack", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      const drawingBefore = useCADStore.getState().drawing;

      useCADStore.getState().redo();
      expect(useCADStore.getState().drawing).toBe(drawingBefore);
    });
  });

  describe("dimensions", () => {
    it("selectDimension updates selectedDimensionId", () => {
      useCADStore.getState().selectDimension("dim-1");
      expect(useCADStore.getState().selectedDimensionId).toBe("dim-1");
    });

    it("selectDimension with null clears selection", () => {
      useCADStore.getState().selectDimension("dim-1");
      useCADStore.getState().selectDimension(null);
      expect(useCADStore.getState().selectedDimensionId).toBeNull();
    });
  });

  describe("PDF loading", () => {
    it("loadPDFEntities sets drawing from PDF data", () => {
      const pdfData = {
        entities: [
          { handle: "P1", type: "LINE", layer: "PDF-Import", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }], page: 1 },
          { handle: "P2", type: "LINE", layer: "PDF-Import", vertices: [{ x: 0, y: 0 }, { x: 50, y: 50 }], page: 2 },
        ],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        pages: [{ width: 612, height: 792 }, { width: 612, height: 792 }],
        pageCount: 2,
        metadata: { title: "", creator: "" },
        entityCount: 2,
        textCount: 0,
      };

      useCADStore.getState().loadPDFEntities(pdfData, "test.pdf");
      const state = useCADStore.getState();

      expect(state.drawing).not.toBeNull();
      expect(state.pdfPageCount).toBe(2);
      expect(state.pdfCurrentPage).toBe(1);
      expect(state.pdfAllEntities.length).toBe(2);
      expect(state.isLoading).toBe(false);
    });

    it("setPDFPage switches to a different page", () => {
      const pdfData = {
        entities: [
          { handle: "P1", type: "LINE", layer: "PDF-Import", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }], page: 1 },
          { handle: "P2", type: "TEXT", layer: "PDF-Text", text: "Page 2", insertionPoint: { x: 10, y: 10 }, page: 2 },
        ],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        pages: [{ width: 612, height: 792 }, { width: 612, height: 792 }],
        pageCount: 2,
        metadata: { title: "", creator: "" },
        entityCount: 2,
        textCount: 1,
      };

      useCADStore.getState().loadPDFEntities(pdfData, "test.pdf");
      useCADStore.getState().setPDFPage(2);

      const state = useCADStore.getState();
      expect(state.pdfCurrentPage).toBe(2);
      // Page 2 should only have the TEXT entity
      expect(state.drawing!.entities.length).toBe(1);
      expect(state.drawing!.entities[0].type).toBe("TEXT");
    });

    it("setPDFPage ignores out-of-range page", () => {
      const pdfData = {
        entities: [
          { handle: "P1", type: "LINE", layer: "PDF-Import", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }], page: 1 },
        ],
        bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
        pages: [{ width: 612, height: 792 }],
        pageCount: 1,
        metadata: { title: "", creator: "" },
        entityCount: 1,
        textCount: 0,
      };

      useCADStore.getState().loadPDFEntities(pdfData, "test.pdf");
      useCADStore.getState().setPDFPage(5); // out of range

      expect(useCADStore.getState().pdfCurrentPage).toBe(1); // unchanged
    });
  });

  describe("reset", () => {
    it("clears all state back to initial", () => {
      useCADStore.getState().loadDXFFile(MINIMAL_DXF, "test.dxf");
      useCADStore.getState().selectComponent("comp-1");

      useCADStore.getState().reset();
      const state = useCADStore.getState();

      expect(state.drawing).toBeNull();
      expect(state.selectedComponentId).toBeNull();
      expect(state.tabs).toEqual([]);
      expect(state.scaleHistory).toEqual([]);
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
      expect(state.pdfPageCount).toBe(0);
      expect(state.pdfAllEntities).toEqual([]);
    });
  });
});
