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
    readFile: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-bytes")),
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
function makeRequest(file?: { name: string; content?: string }) {
  const jsonContent = file?.content ?? '{"entities":[],"bounds":{"min":{"x":0,"y":0},"max":{"x":100,"y":100}}}';
  const fakeFile = file
    ? {
        name: file.name,
        arrayBuffer: async () => new TextEncoder().encode(jsonContent).buffer,
      }
    : null;

  return {
    formData: async () => ({
      get: (key: string) => (key === "file" ? fakeFile : null),
    }),
    nextUrl: new URL("http://localhost:3000/api/export-pdf"),
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/export-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("file");
  });

  it("returns PDF binary on success", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: JSON.stringify({ success: true }),
      stderr: "",
    });

    const res = await POST(makeRequest({ name: "entities.json" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("returns 500 when script reports error", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: JSON.stringify({ error: "Failed to render PDF" }),
      stderr: "",
    });

    const res = await POST(makeRequest({ name: "entities.json" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to render PDF");
  });

  it("returns 500 on subprocess failure", async () => {
    mockExecAsync.mockRejectedValueOnce(new Error("Script crashed"));

    const res = await POST(makeRequest({ name: "entities.json" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Script crashed");
  });
});
