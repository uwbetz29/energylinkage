import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Mock Supabase client before importing the store
vi.mock("@/lib/supabase/client", () => {
  const mockChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockReturnValue(chain);
    chain.then = vi.fn((cb: (result: { data: unknown; error: null }) => void) => {
      cb({ data: null, error: null });
      return chain;
    });
    // Default resolution
    (chain as Record<string, unknown>).data = null;
    (chain as Record<string, unknown>).error = null;
    return chain;
  };

  const fromMock = vi.fn(() => mockChain());

  return {
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "test-user-id", email: "test@example.com" },
            },
          },
        }),
      },
      from: fromMock,
    })),
    __fromMock: fromMock,
  };
});

import { useProjectStore } from "../store";
import { createClient } from "@/lib/supabase/client";

function resetProjectStore() {
  useProjectStore.setState({
    projects: [],
    currentProjectId: null,
    isLoaded: false,
    isSyncing: false,
  });
}

describe("Project Store", () => {
  beforeEach(() => {
    resetProjectStore();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with empty projects", () => {
      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.currentProjectId).toBeNull();
      expect(state.isLoaded).toBe(false);
    });
  });

  describe("openProject", () => {
    it("sets currentProjectId", () => {
      useProjectStore.getState().openProject("proj-123");
      expect(useProjectStore.getState().currentProjectId).toBe("proj-123");
    });
  });

  describe("closeProject", () => {
    it("clears currentProjectId", () => {
      useProjectStore.getState().openProject("proj-123");
      useProjectStore.getState().closeProject();
      expect(useProjectStore.getState().currentProjectId).toBeNull();
    });
  });

  describe("getCurrentProject", () => {
    it("returns null when no project selected", () => {
      expect(useProjectStore.getState().getCurrentProject()).toBeNull();
    });

    it("returns the matching project", () => {
      useProjectStore.setState({
        projects: [
          {
            id: "proj-1",
            userId: "user-1",
            name: "Project One",
            description: "",
            systemType: "scr-co-catalyst",
            data: {},
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
            deletedAt: null,
            drawings: [],
          },
        ],
        currentProjectId: "proj-1",
      });

      const project = useProjectStore.getState().getCurrentProject();
      expect(project).not.toBeNull();
      expect(project!.name).toBe("Project One");
    });

    it("returns null for non-existent project id", () => {
      useProjectStore.setState({
        projects: [],
        currentProjectId: "nonexistent",
      });

      expect(useProjectStore.getState().getCurrentProject()).toBeNull();
    });
  });

  describe("loadProjects", () => {
    it("calls supabase and sets isLoaded", async () => {
      const supabase = createClient();
      const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
      const chain = mockFrom();

      // Override the order method to resolve with empty data
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });

      // Re-mock from to return this chain
      mockFrom.mockReturnValue(chain);

      await useProjectStore.getState().loadProjects();

      expect(useProjectStore.getState().isLoaded).toBe(true);
      expect(useProjectStore.getState().isSyncing).toBe(false);
    });
  });
});
