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
    readFile: vi.fn().mockResolvedValue("0\nEOF\n"),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error("not found")),
    constants: { X_OK: 1, F_OK: 0 },
  };
  return { ...mod, default: mod };
});

// Mock execAsync
const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));
vi.mock("@/lib/exec-async", () => ({
  execAsync: mockExecAsync,
}));

import { POST } from "../route";
import { access } from "fs/promises";

/** Create a fake request with a mockable formData() method */
function makeRequest(file?: { name: string; content?: string }) {
  const fakeFile = file
    ? {
        name: file.name,
        arrayBuffer: async () => new TextEncoder().encode(file.content ?? "fake").buffer,
      }
    : null;

  return {
    formData: async () => ({
      get: (key: string) => (key === "file" ? fakeFile : null),
    }),
    nextUrl: new URL("http://localhost:3000/api/convert"),
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/convert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No file");
  });

  it("returns 400 for non-DWG file", async () => {
    const res = await POST(makeRequest({ name: "drawing.dxf" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("DWG");
  });

  it("returns 501 when no converter is available", async () => {
    const res = await POST(makeRequest({ name: "drawing.dwg" }));
    expect(res.status).toBe(501);
  });

  it("attempts to find dwg2dxf executable", async () => {
    await POST(makeRequest({ name: "drawing.dwg" }));
    expect(access).toHaveBeenCalled();
  });
});
