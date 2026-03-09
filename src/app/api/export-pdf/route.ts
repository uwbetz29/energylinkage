import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execAsync } from "@/lib/exec-async";

/**
 * POST /api/export-pdf
 *
 * Accepts a FormData body with a JSON file containing modified drawing entities.
 * Renders them to a new PDF via PyMuPDF.
 *
 * FormData: { file: Blob (JSON with entities, bounds, pages, metadata) }
 * Returns: PDF file as binary download
 */
export async function POST(request: NextRequest) {
  const sessionId = randomUUID();
  const workDir = join(tmpdir(), `el-pdf-export-${sessionId}`);
  const jsonPath = join(workDir, "entities.json");
  const outputPath = join(workDir, "output.pdf");

  try {
    await mkdir(workDir, { recursive: true });

    // Read FormData — uses multipart handling which supports large files
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Missing 'file' field in FormData" },
        { status: 400 }
      );
    }

    // Write JSON blob to temp file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(jsonPath, buffer);

    console.log(`PDF export: ${buffer.length} bytes written to ${jsonPath}`);

    // Find the export script
    const scriptPath = join(process.cwd(), "scripts", "pdf-export.py");

    // Use absolute python3 path to avoid PATH issues in Next.js child processes
    const python3 =
      process.env.PYTHON3_PATH ||
      "/Library/Frameworks/Python.framework/Versions/3.12/bin/python3";

    const { stdout, stderr } = await execAsync(
      `"${python3}" "${scriptPath}" "${jsonPath}" "${outputPath}"`,
      {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024,
      }
    );

    if (stderr) {
      console.warn("PDF export stderr:", stderr);
    }

    // Check script result
    const result = JSON.parse(stdout);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Read the generated PDF
    const pdfBytes = await readFile(outputPath);

    // Clean up temp files
    await unlink(jsonPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ELF-export-${Date.now()}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    await unlink(jsonPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    const message = err instanceof Error ? err.message : "PDF export failed";
    console.error("PDF export error:", message);

    return NextResponse.json(
      { error: message.substring(0, 500) },
      { status: 500 }
    );
  }
}
