import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink, mkdir, access, constants } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { randomUUID } from "crypto";
import { execAsync } from "@/lib/exec-async";

// Paths to look for dwg2dxf (libredwg) and ODA File Converter
const DWG2DXF_PATHS = [
  join(homedir(), "bin", "dwg2dxf"),
  "/usr/local/bin/dwg2dxf",
  "/usr/bin/dwg2dxf",
];

const ODA_PATHS = [
  "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter",
  "/usr/bin/ODAFileConverter",
  "C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe",
];

async function findExecutable(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      await access(p, constants.X_OK);
      return p;
    } catch {
      // Try next path
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "dwg") {
      return NextResponse.json(
        { error: "Only DWG files need conversion" },
        { status: 400 }
      );
    }

    // Create temp directory
    const sessionId = randomUUID();
    const workDir = join(tmpdir(), `el-convert-${sessionId}`);
    await mkdir(workDir, { recursive: true });

    const inputPath = join(workDir, file.name);
    const outputFileName = file.name.replace(/\.dwg$/i, ".dxf");
    const outputPath = join(workDir, outputFileName);

    // Write uploaded file to temp
    const bytes = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(bytes));

    let converted = false;

    // Try dwg2dxf (libredwg) first — faster, no GUI dependency
    // Note: dwg2dxf may exit with non-zero code due to warnings but still produce valid output
    const dwg2dxfPath = await findExecutable(DWG2DXF_PATHS);
    if (dwg2dxfPath) {
      try {
        await execAsync(
          `"${dwg2dxfPath}" -y -o "${outputPath}" "${inputPath}"`,
          { timeout: 60000 }
        );
        converted = true;
      } catch {
        // dwg2dxf may exit non-zero due to warnings — check if output was still produced
        try {
          const stat = await access(outputPath, constants.R_OK);
          converted = true;
        } catch {
          console.error("dwg2dxf failed to produce output");
        }
      }
    }

    // Fall back to ODA File Converter
    if (!converted) {
      const odaPath = await findExecutable(ODA_PATHS);
      if (odaPath) {
        const inputDir = workDir;
        const outputDir = join(workDir, "out");
        await mkdir(outputDir, { recursive: true });

        try {
          await execAsync(
            `"${odaPath}" "${inputDir}" "${outputDir}" "ACAD2018" "DXF" "0" "1"`,
            { timeout: 60000 }
          );
          // ODA outputs to outputDir
          const odaOutput = join(outputDir, outputFileName);
          const content = await readFile(odaOutput, "utf-8");
          await writeFile(outputPath, content);
          converted = true;
        } catch (err) {
          console.error("ODA conversion failed:", err);
        }
      }
    }

    if (!converted) {
      // Clean up
      await unlink(inputPath).catch(() => {});
      return new NextResponse(
        "DWG conversion requires dwg2dxf (libredwg) or ODA File Converter. Please install one of these tools, or upload a DXF file instead.",
        { status: 501 }
      );
    }

    // Read output DXF
    let dxfContent: string;
    try {
      dxfContent = await readFile(outputPath, "utf-8");
    } catch {
      await unlink(inputPath).catch(() => {});
      return new NextResponse(
        "Conversion produced no output. The DWG file may be corrupt or unsupported.",
        { status: 500 }
      );
    }

    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    return new NextResponse(dxfContent, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    return new NextResponse(
      `Server error: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
