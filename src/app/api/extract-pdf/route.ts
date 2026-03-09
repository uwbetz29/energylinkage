import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execAsync } from "@/lib/exec-async";

/**
 * POST /api/extract-pdf
 *
 * Accepts a PDF file upload, extracts vector geometry and text using PyMuPDF,
 * and returns JSON with entities in our ParsedEntity-compatible format.
 *
 * Query params:
 *   page - optional page number (1-based). Omit to extract all pages.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Get optional page number
    const pageParam = request.nextUrl.searchParams.get("page");

    // Write uploaded file to temp
    const sessionId = randomUUID();
    const workDir = join(tmpdir(), `el-pdf-${sessionId}`);
    await mkdir(workDir, { recursive: true });
    const inputPath = join(workDir, file.name);

    const bytes = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(bytes));

    // Find the extraction script
    const scriptPath = join(process.cwd(), "scripts", "pdf-extract.py");

    try {
      // Run the Python extraction script
      const pageArg = pageParam ? ` ${pageParam}` : "";
      const { stdout, stderr } = await execAsync(
        `python3 "${scriptPath}" "${inputPath}"${pageArg}`,
        {
          timeout: 120000, // 2 minute timeout for large PDFs
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large drawings
        }
      );

      if (stderr) {
        console.warn("PDF extraction warnings:", stderr);
      }

      // Parse and validate the output
      const result = JSON.parse(stdout);

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      // Clean up
      await unlink(inputPath).catch(() => {});

      return NextResponse.json(result);
    } catch (err) {
      // Clean up on error
      await unlink(inputPath).catch(() => {});

      const message =
        err instanceof Error ? err.message : "PDF extraction failed";

      // Check if Python/PyMuPDF is missing
      if (message.includes("python3") || message.includes("No such file")) {
        return NextResponse.json(
          {
            error:
              "Python 3 with PyMuPDF is required for PDF extraction. Install with: pip3 install PyMuPDF",
          },
          { status: 501 }
        );
      }

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: `Server error: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
