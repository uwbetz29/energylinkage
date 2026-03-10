import { create } from "zustand";

/* ─── Types ─── */

export interface ComponentDef {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  /** Bounding box on drawing as % of page: [left, top, width, height] */
  box: [number, number, number, number];
  /** Editable dimensions keyed by label */
  dims: Record<string, string>;
  /** Which dim key is the "main" one for quick-adjust */
  mainDim: string;
  constraints: { label: string; value: string; ok: boolean }[];
  /** IDs of downstream components that shift when this resizes */
  downstream: string[];
  upstream: string[];
  notes: string;
}

export type Stage = "import" | "configure" | "review" | "export";

export interface EditorState {
  /* Project */
  projectId: string | null;
  projectName: string | null;

  /* Drawing */
  pdfUrl: string | null;
  currentSheet: number;
  totalSheets: number;

  /* Components */
  components: Record<string, ComponentDef>;
  selectedId: string | null;
  showOverlays: boolean;
  showDiff: boolean;

  /* Changes tracking: componentId → { dimKey → originalValue } */
  originals: Record<string, Record<string, string>>;
  changeCount: number;

  /* Stage */
  stage: Stage;

  /* Zoom / Pan */
  zoom: number;
  panX: number;
  panY: number;

  /* Actions */
  setProject: (id: string, name: string) => void;
  setPdfUrl: (url: string) => void;
  setSheet: (n: number) => void;
  setComponents: (comps: Record<string, ComponentDef>) => void;
  select: (id: string | null) => void;
  toggleOverlays: () => void;
  toggleDiff: () => void;
  setStage: (s: Stage) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  updateDim: (compId: string, dimKey: string, value: string) => void;
  quickAdjust: (compId: string, deltaFt: number) => void;
  resetComp: (compId: string) => void;
}

/* ─── Helpers ─── */

function parseFtIn(s: string): number {
  const m = s.match(/(\d+)'[- ]?(\d+)?/);
  if (!m) return 0;
  return parseInt(m[1]) * 12 + (parseInt(m[2]) || 0);
}

function toFtIn(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inn = inches % 12;
  return inn === 0 ? `${ft}'-0"` : `${ft}'-${inn}"`;
}

/* ─── Store ─── */

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: null,

  pdfUrl: null,
  currentSheet: 2,
  totalSheets: 3,

  components: {},
  selectedId: null,
  showOverlays: false,
  showDiff: false,

  originals: {},
  changeCount: 0,

  stage: "configure",

  zoom: 1,
  panX: 0,
  panY: 0,

  setProject: (id, name) => set({ projectId: id, projectName: name }),
  setPdfUrl: (url) => set({ pdfUrl: url }),
  setSheet: (n) => set({ currentSheet: n }),
  setComponents: (comps) => set({ components: comps }),

  select: (id) => set({ selectedId: id }),
  toggleOverlays: () => set((s) => ({ showOverlays: !s.showOverlays })),
  toggleDiff: () => set((s) => ({ showDiff: !s.showDiff })),
  setStage: (s) => set({ stage: s }),
  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(5, z)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  updateDim: (compId, dimKey, value) => {
    const { components, originals } = get();
    const comp = components[compId];
    if (!comp) return;

    // Save original if first edit
    const compOrig = originals[compId] ?? {};
    if (!(dimKey in compOrig)) {
      compOrig[dimKey] = comp.dims[dimKey];
    }

    const newComps = {
      ...components,
      [compId]: {
        ...comp,
        dims: { ...comp.dims, [dimKey]: value },
      },
    };

    // Count total changes
    const newOrig = { ...originals, [compId]: compOrig };
    let count = 0;
    for (const cid of Object.keys(newOrig)) {
      for (const dk of Object.keys(newOrig[cid])) {
        if (newComps[cid]?.dims[dk] !== newOrig[cid][dk]) count++;
      }
    }

    set({ components: newComps, originals: newOrig, changeCount: count });
  },

  quickAdjust: (compId, deltaFt) => {
    const { components } = get();
    const comp = components[compId];
    if (!comp) return;
    const key = comp.mainDim;
    const current = comp.dims[key];
    const inches = parseFtIn(current);
    if (!inches) return;
    const newInches = Math.max(12, inches + deltaFt * 12);
    get().updateDim(compId, key, toFtIn(newInches));
  },

  resetComp: (compId) => {
    const { components, originals } = get();
    const comp = components[compId];
    const compOrig = originals[compId];
    if (!comp || !compOrig) return;

    const restoredDims = { ...comp.dims };
    for (const [k, v] of Object.entries(compOrig)) {
      restoredDims[k] = v;
    }

    const newOrig = { ...originals };
    delete newOrig[compId];

    let count = 0;
    for (const cid of Object.keys(newOrig)) {
      for (const dk of Object.keys(newOrig[cid])) {
        if (components[cid]?.dims[dk] !== newOrig[cid][dk]) count++;
      }
    }

    set({
      components: {
        ...components,
        [compId]: { ...comp, dims: restoredDims },
      },
      originals: newOrig,
      changeCount: count,
    });
  },
}));
