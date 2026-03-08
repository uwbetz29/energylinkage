// Zustand store for CAD viewer state management
import { create } from "zustand";
import type {
  ParsedDrawing,
  ScaleMode,
  ScaleOperation,
  CADComponent,
} from "@/types/cad";
import { parseDXF } from "./dxf-parse";
import { detectComponents } from "./component-detector";
import { scaleComponent, type ScaleParams } from "./geometry-scaler";

interface CADStore {
  // Drawing state
  drawing: ParsedDrawing | null;
  isLoading: boolean;
  error: string | null;

  // Selection state
  selectedComponentId: string | null;
  hoveredComponentId: string | null;

  // Settings
  scaleMode: ScaleMode;
  layerVisibility: Record<string, boolean>;

  // History
  scaleHistory: ScaleOperation[];
  undoStack: ParsedDrawing[];

  // Actions
  loadDXFFile: (content: string, fileName: string) => void;
  selectComponent: (componentId: string | null) => void;
  hoverComponent: (componentId: string | null) => void;
  setScaleMode: (mode: ScaleMode) => void;
  toggleLayerVisibility: (layerName: string) => void;
  applyScale: (params: ScaleParams) => void;
  undo: () => void;
  getSelectedComponent: () => CADComponent | null;
  reset: () => void;
}

export const useCADStore = create<CADStore>((set, get) => ({
  drawing: null,
  isLoading: false,
  error: null,
  selectedComponentId: null,
  hoveredComponentId: null,
  scaleMode: "linked",
  layerVisibility: {},
  scaleHistory: [],
  undoStack: [],

  loadDXFFile: (content: string, fileName: string) => {
    set({ isLoading: true, error: null });
    try {
      const drawing = parseDXF(content, fileName);
      // Run component detection
      drawing.components = detectComponents(drawing);

      // Initialize layer visibility
      const layerVisibility: Record<string, boolean> = {};
      for (const layer of drawing.layers) {
        layerVisibility[layer.name] = layer.visible;
      }

      set({
        drawing,
        isLoading: false,
        layerVisibility,
        selectedComponentId: null,
        hoveredComponentId: null,
        scaleHistory: [],
        undoStack: [],
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to parse DXF file",
      });
    }
  },

  selectComponent: (componentId: string | null) => {
    set({ selectedComponentId: componentId });
  },

  hoverComponent: (componentId: string | null) => {
    set({ hoveredComponentId: componentId });
  },

  setScaleMode: (mode: ScaleMode) => {
    set({ scaleMode: mode });
  },

  toggleLayerVisibility: (layerName: string) => {
    const { layerVisibility } = get();
    set({
      layerVisibility: {
        ...layerVisibility,
        [layerName]: !layerVisibility[layerName],
      },
    });
  },

  applyScale: (params: ScaleParams) => {
    const { drawing, scaleMode, scaleHistory, undoStack } = get();
    if (!drawing) return;

    try {
      const result = scaleComponent(drawing, params, scaleMode);
      set({
        drawing: result.drawing,
        scaleHistory: [...scaleHistory, result.operation],
        undoStack: [...undoStack, drawing], // Save current state for undo
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to apply scale",
      });
    }
  },

  undo: () => {
    const { undoStack, scaleHistory } = get();
    if (undoStack.length === 0) return;

    const previousDrawing = undoStack[undoStack.length - 1];
    set({
      drawing: previousDrawing,
      undoStack: undoStack.slice(0, -1),
      scaleHistory: scaleHistory.slice(0, -1),
    });
  },

  getSelectedComponent: () => {
    const { drawing, selectedComponentId } = get();
    if (!drawing || !selectedComponentId) return null;
    return (
      drawing.components.find((c) => c.id === selectedComponentId) || null
    );
  },

  reset: () => {
    set({
      drawing: null,
      isLoading: false,
      error: null,
      selectedComponentId: null,
      hoveredComponentId: null,
      scaleHistory: [],
      undoStack: [],
      layerVisibility: {},
    });
  },
}));
