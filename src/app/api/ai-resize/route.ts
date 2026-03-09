import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AIResizeRequest, AIResizeResponse, EntityTransform } from "@/types/ai-resize";
import { buildSystemPrompt, buildUserMessage, TOOL_SCHEMA } from "@/lib/cad/ai-resize-prompt";

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

export async function POST(request: NextRequest) {
  let body: AIResizeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.dimension || !body.entities) {
    return NextResponse.json(
      { error: "Missing dimension or entities" },
      { status: 400 }
    );
  }

  // Cap entity count to prevent excessive token usage
  const MAX_ENTITIES = 200;
  if (body.entities.length > MAX_ENTITIES) {
    body.entities = body.entities.slice(0, MAX_ENTITIES);
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
      system: buildSystemPrompt(),
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "apply_resize_transforms" },
      messages: [
        {
          role: "user",
          content: buildUserMessage(body),
        },
      ],
    });

    // Extract tool use result
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "AI did not return structured transforms" },
        { status: 502 }
      );
    }

    const result = toolUse.input as {
      transforms: EntityTransform[];
      reasoning: string;
    };

    // Validate handles — keep only transforms referencing known entities
    const validHandles = new Set(body.entities.map((e) => e.handle));
    validHandles.add(body.dimension.textHandle);
    for (const h of body.dimension.annotationHandles) validHandles.add(h);
    for (const h of body.dimension.geometryHandles) validHandles.add(h);

    const validTransforms = result.transforms.filter((t) =>
      validHandles.has(t.handle)
    );

    const aiResponse: AIResizeResponse = {
      transforms: validTransforms,
      reasoning: result.reasoning || "Resize applied.",
      source: "ai",
    };

    return NextResponse.json(aiResponse);
  } catch (err) {
    console.error("[ai-resize] Claude API error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI resize failed",
      },
      { status: 502 }
    );
  }
}
