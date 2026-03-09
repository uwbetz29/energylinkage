import { describe, it, expect } from "vitest";
import { mapProjectFromDB, mapDrawingFromDB } from "../types";

describe("mapProjectFromDB", () => {
  it("maps snake_case DB row to camelCase Project", () => {
    const row = {
      id: "proj-1",
      user_id: "user-1",
      name: "Test Project",
      description: "A project",
      system_type: "scr-co-catalyst",
      data: { key: "val" },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
      deleted_at: null,
      drawings: [],
    };

    const project = mapProjectFromDB(row);
    expect(project.id).toBe("proj-1");
    expect(project.userId).toBe("user-1");
    expect(project.name).toBe("Test Project");
    expect(project.description).toBe("A project");
    expect(project.systemType).toBe("scr-co-catalyst");
    expect(project.data).toEqual({ key: "val" });
    expect(project.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(project.updatedAt).toBe("2025-01-02T00:00:00Z");
    expect(project.deletedAt).toBeNull();
    expect(project.drawings).toEqual([]);
  });

  it("defaults missing optional fields", () => {
    const row = {
      id: "proj-2",
      user_id: "user-1",
      name: "Minimal",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      // description, system_type, data, deleted_at, drawings all missing
    };

    const project = mapProjectFromDB(row);
    expect(project.description).toBe("");
    expect(project.systemType).toBe("scr-co-catalyst");
    expect(project.data).toEqual({});
    expect(project.deletedAt).toBeNull();
    expect(project.drawings).toEqual([]);
  });

  it("maps nested drawings through mapDrawingFromDB", () => {
    const row = {
      id: "proj-3",
      user_id: "user-1",
      name: "With Drawing",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      drawings: [
        {
          id: "draw-1",
          project_id: "proj-3",
          name: "Main Drawing",
          file_name: "main.dxf",
          storage_path: "/files/main.dxf",
          file_size_bytes: 1024,
          dxf_content: "0\nEOF\n",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
    };

    const project = mapProjectFromDB(row);
    expect(project.drawings).toHaveLength(1);
    expect(project.drawings[0].fileName).toBe("main.dxf");
    expect(project.drawings[0].projectId).toBe("proj-3");
  });
});

describe("mapDrawingFromDB", () => {
  it("maps snake_case DB row to camelCase ProjectDrawing", () => {
    const row = {
      id: "draw-1",
      project_id: "proj-1",
      name: "Drawing One",
      file_name: "drawing.dxf",
      storage_path: "/files/drawing.dxf",
      file_size_bytes: 2048,
      dxf_content: "some dxf content",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    };

    const drawing = mapDrawingFromDB(row);
    expect(drawing.id).toBe("draw-1");
    expect(drawing.projectId).toBe("proj-1");
    expect(drawing.name).toBe("Drawing One");
    expect(drawing.fileName).toBe("drawing.dxf");
    expect(drawing.storagePath).toBe("/files/drawing.dxf");
    expect(drawing.fileSizeBytes).toBe(2048);
    expect(drawing.dxfContent).toBe("some dxf content");
    expect(drawing.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(drawing.updatedAt).toBe("2025-01-02T00:00:00Z");
  });

  it("handles null optional fields", () => {
    const row = {
      id: "draw-2",
      project_id: "proj-1",
      name: "Minimal",
      file_name: "min.dxf",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      // storage_path, file_size_bytes, dxf_content all missing
    };

    const drawing = mapDrawingFromDB(row);
    expect(drawing.storagePath).toBeNull();
    expect(drawing.fileSizeBytes).toBeNull();
    expect(drawing.dxfContent).toBeNull();
  });
});
