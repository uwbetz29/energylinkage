import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/server
vi.mock("next/server", () => {
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
    }
  }
  return { NextRequest: class {}, NextResponse: MockNextResponse };
});

// Mock fs/promises
vi.mock("fs/promises", () => {
  const mod = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
  return { ...mod, default: mod };
});

// Mock execAsync
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));
vi.mock("@/lib/exec-async", () => ({
  execAsync: mockExecAsync,
}));

import { POST } from "../route";

/** Create a fake request with a mockable formData() method */
function makeRequest(file?: { name: string; content?: string }, page?: string) {
  const fakeFile = file
    ? {
        name: file.name,
        arrayBuffer: async () => new TextEncoder().encode(file.content ?? "fake pdf").buffer,
      }
    : null;

  const url = new URL("http://localhost:3000/api/extract-pdf");
  if (page) url.searchParams.set("page", page);

  return {
    formData: async () => ({
      get: (key: string) => (key === "file" ? fakeFile : null),
    }),
    nextUrl: url,
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/extract-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No file");
  });

  it("returns 400 for non-PDF file", async () => {
    const res = await POST(makeRequest({ name: "drawing.dxf" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("PDF");
  });

  it("returns extracted JSON on success", async () => {
    const mockResult = {
      entities: [{ handle: "P1", type: "LINE", layer: "PDF-Import" }],
      bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
      pages: [{ width: 612, height: 792 }],
      entityCount: 1,
      textCount: 0,
      metadata: { title: "", creator: "" },
    };
    mockExecAsync.mockResolvedValueOnce({
      stdout: JSON.stringify(mockResult),
      stderr: "",
    });

    const res = await POST(makeRequest({ name: "test.pdf" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entities).toHaveLength(1);
    expect(body.entityCount).toBe(1);
  });

  it("returns 500 when script reports error", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: JSON.stringify({ error: "PyMuPDF not installed" }),
      stderr: "",
    });

    const res = await POST(makeRequest({ name: "test.pdf" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("PyMuPDF");
  });

  it("returns 501 when python3 is not found", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("python3: No such file"));

    const res = await POST(makeRequest({ name: "test.pdf" }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
