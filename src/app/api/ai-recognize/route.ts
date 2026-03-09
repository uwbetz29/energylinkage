import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { RecognizedComponent, FlowDirection } from "@/types/component-recognition";
import {
  buildRecognitionSystemPrompt,
  buildRecognitionUserMessage,
  RECOGNIZE_TOOL_SCHEMA,
} from "@/lib/cad/component-recognize-prompt";
import type { GeometrySummary } from "@/types/component-recognition";

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

interface RequestBody {
  summary: GeometrySummary;
  drawingBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.summary || !body.drawingBounds) {
    return NextResponse.json(
      { error: "Missing summary or drawingBounds" },
      { status: 400 }
    );
  }

  let client: Anthropic;
  try {
    client = getClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildRecognitionSystemPrompt(),
      tools: [RECOGNIZE_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "recognize_components" },
      messages: [
        {
          role: "user",
          content: buildRecognitionUserMessage(body.summary, body.drawingBounds),
        },
      ],
    });

    // Extract tool use result
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "AI did not return structured component recognition" },
        { status: 502 }
      );
    }

    const result = toolUse.input as {
      components: Array<{
        id: string;
        type: string;
        label: string;
        boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
        confidence: number;
      }>;
      flowDirection: FlowDirection;
      reasoning: string;
    };

    // Build recognized components (dimensionIds will be assigned by the store)
    const components: RecognizedComponent[] = result.components.map((c) => ({
      id: c.id,
      type: c.type as RecognizedComponent["type"],
      label: c.label,
      boundingBox: c.boundingBox,
      confidence: c.confidence,
      dimensionIds: [], // Will be populated by spatial containment in the store
    }));

    return NextResponse.json({
      components,
      flowDirection: result.flowDirection,
      reasoning: result.reasoning,
    });
  } catch (err) {
    console.error("[ai-recognize] Claude API error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI recognition failed",
      },
      { status: 502 }
    );
  }
}
