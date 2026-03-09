import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DimensionOverlay } from "../DimensionOverlay";
import { useCADStore } from "@/lib/cad/store";
import { createTestDrawing, createTestDimension } from "@/lib/cad/__tests__/fixtures/sample-drawing";
import type { ParametricDimension } from "@/types/cad";

// Mock the renderer module since it needs WebGL
vi.mock("@/lib/cad/renderer", () => ({
  CADRenderer: vi.fn(),
}));

// Create a mock renderer
function createMockRenderer() {
  const viewChangeCallbacks: Array<() => void> = [];
  return {
    worldToScreen: vi.fn((x: number, y: number) => ({ x: x + 100, y: y + 100 })),
    onViewChange: vi.fn((cb: () => void) => { viewChangeCallbacks.push(cb); }),
    removeViewChangeCallback: vi.fn(),
    _triggerViewChange: () => viewChangeCallbacks.forEach((cb) => cb()),
  };
}

function setupStoreWithDimension(dim?: ParametricDimension) {
  const drawing = createTestDrawing();
  const dimension = dim || createTestDimension();

  useCADStore.setState({
    drawing,
    dimensions: [dimension],
    selectedDimensionId: null,
    selectedComponentId: null,
  });

  return { drawing, dimension };
}

describe("DimensionOverlay", () => {
  beforeEach(() => {
    useCADStore.getState().reset();
  });

  it("renders nothing when no drawing is loaded", () => {
    const mockRenderer = createMockRenderer();
    const { container } = render(
      <DimensionOverlay renderer={mockRenderer as any} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no dimensions exist", () => {
    useCADStore.setState({
      drawing: createTestDrawing(),
      dimensions: [],
    });

    const mockRenderer = createMockRenderer();
    const { container } = render(
      <DimensionOverlay renderer={mockRenderer as any} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dimension labels when dimensions exist", () => {
    setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    // Should show the dimension text
    expect(screen.getByText("10'-0\"")).toBeInTheDocument();
  });

  it("calls worldToScreen to position labels", () => {
    setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    expect(mockRenderer.worldToScreen).toHaveBeenCalled();
  });

  it("selects dimension on click", () => {
    const { dimension } = setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    const label = screen.getByText("10'-0\"");
    fireEvent.click(label);

    expect(useCADStore.getState().selectedDimensionId).toBe(dimension.id);
  });

  it("shows edit popup when dimension is selected", () => {
    const { dimension } = setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    // Select the dimension
    useCADStore.setState({ selectedDimensionId: dimension.id });

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    expect(screen.getByText("Edit Dimension")).toBeInTheDocument();
    expect(screen.getByText("Explicit Value")).toBeInTheDocument();
    expect(screen.getByText("% Scale")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("deselects on Escape key", () => {
    const { dimension } = setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    useCADStore.setState({ selectedDimensionId: dimension.id });

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    const input = screen.getByPlaceholderText(/e\.g\. 50/);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(useCADStore.getState().selectedDimensionId).toBeNull();
  });

  it("shows close button in edit popup", () => {
    const { dimension } = setupStoreWithDimension();
    const mockRenderer = createMockRenderer();

    useCADStore.setState({ selectedDimensionId: dimension.id });

    render(<DimensionOverlay renderer={mockRenderer as any} />);

    // The close button has × text
    expect(screen.getByText("×")).toBeInTheDocument();
  });
});
