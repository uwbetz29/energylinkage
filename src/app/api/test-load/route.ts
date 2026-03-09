import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execAsync } from "@/lib/exec-async";

/**
 * POST /api/test-load
 * Dev-only: Load a file from a local filesystem path, process it, and return data.
 * Accepts JSON body: { path: string }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { path: filePath } = await request.json();
    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const ext = filePath.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      // Run PDF extraction
      const scriptPath = join(process.cwd(), "scripts", "pdf-extract.py");
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${filePath}"`,
        { timeout: 120000, maxBuffer: 100 * 1024 * 1024 }
      );
      if (stderr) console.warn("PDF extraction warnings:", stderr);
      const result = JSON.parse(stdout);
      return NextResponse.json({ type: "pdf", data: result });
    }

    if (ext === "dwg") {
      // Convert DWG to DXF
      const sessionId = randomUUID();
      const workDir = join(tmpdir(), `el-test-${sessionId}`);
      await mkdir(workDir, { recursive: true });
      const outputPath = join(workDir, "output.dxf");

      const dwg2dxf = join(process.env.HOME || "/Users/mike", "bin", "dwg2dxf");
      const { stderr } = await execAsync(
        `"${dwg2dxf}" -o "${outputPath}" "${filePath}"`,
        { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
      );
      if (stderr) console.warn("DWG conversion warnings:", stderr);

      const dxfContent = await readFile(outputPath, "utf-8");
      await unlink(outputPath).catch(() => {});
      return NextResponse.json({ type: "dxf", data: dxfContent });
    }

    if (ext === "dxf") {
      const content = await readFile(filePath, "utf-8");
      return NextResponse.json({ type: "dxf", data: content });
    }

    return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load file" },
      { status: 500 }
    );
  }
}
