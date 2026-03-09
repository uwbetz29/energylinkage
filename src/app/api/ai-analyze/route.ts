import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CompositeAnalysis,
  ClarificationQuestion,
  ComponentIdentity,
  CrossPageDimensionLink,
  CompositePageSource,
} from "@/types/composite";
import {
  buildCompositeSystemPrompt,
  buildCompositeUserMessage,
  COMPOSITE_ANALYSIS_TOOL,
  ASK_CLARIFICATION_TOOL,
} from "@/lib/cad/composite-prompt";

const getClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

export async function POST(request: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pageSummaries || body.pageSummaries.length === 0) {
    return NextResponse.json(
      { error: "No page summaries provided" },
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
    // Build conversation messages
    const messages: Anthropic.MessageParam[] = [];

    // Add prior conversation history if multi-turn
    if (body.messages) {
      for (const msg of body.messages) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Add the current user message
    messages.push({
      role: "user",
      content: buildCompositeUserMessage(body),
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: buildCompositeSystemPrompt(),
      tools: [COMPOSITE_ANALYSIS_TOOL, ASK_CLARIFICATION_TOOL],
      messages,
    });

    // Find tool use in response
    const toolUse = response.content.find((c) => c.type === "tool_use");

    if (!toolUse || toolUse.type !== "tool_use") {
      // AI responded with text only — treat as a general message
      const textContent = response.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n");

      return NextResponse.json({
        status: "needs_clarification",
        questions: [
          {
            id: "general",
            question: textContent || "Could you provide more details about these drawings?",
            context: "The AI needs more information to complete the analysis.",
          },
        ],
      } satisfies AnalyzeResponse);
    }

    if (toolUse.name === "ask_clarification") {
      const input = toolUse.input as { questions: ClarificationQuestion[] };

      return NextResponse.json({
        status: "needs_clarification",
        questions: input.questions,
      } satisfies AnalyzeResponse);
    }

    if (toolUse.name === "composite_analysis") {
      const input = toolUse.input as {
        components: ComponentIdentity[];
        dimensionLinks: CrossPageDimensionLink[];
        pageSources: CompositePageSource[];
      };

      // Validate referenced IDs
      const validPageSources = new Set(
        body.pageSummaries.map((p) => p.pageSource)
      );
      const validComponentIds = new Set(
        body.pageSummaries.flatMap((p) => p.components.map((c) => c.id))
      );
      const validDimensionIds = new Set(
        body.pageSummaries.flatMap((p) => p.dimensions.map((d) => d.id))
      );

      // Filter page appearances to only reference valid component IDs
      const validatedComponents = input.components.map((comp) => {
        const filteredAppearances: Record<string, string[]> = {};
        for (const [pageSource, compIds] of Object.entries(comp.pageAppearances)) {
          if (validPageSources.has(pageSource)) {
            filteredAppearances[pageSource] = compIds.filter((id) =>
              validComponentIds.has(id)
            );
          }
        }
        return { ...comp, pageAppearances: filteredAppearances };
      });

      // Filter dimension links to only reference valid dimension IDs
      const validatedDimensionLinks = input.dimensionLinks.map((link) => ({
        ...link,
        instances: link.instances.filter(
          (inst) =>
            validPageSources.has(inst.pageSource) &&
            validDimensionIds.has(inst.dimensionId)
        ),
      }));

      // Filter page sources
      const validatedPageSources = input.pageSources.filter((ps) =>
        validPageSources.has(ps.id)
      );

      const analysis: CompositeAnalysis = {
        version: 1,
        analyzedAt: new Date().toISOString(),
        model: "claude-sonnet-4-20250514",
        components: validatedComponents,
        dimensionLinks: validatedDimensionLinks,
        pageSources: validatedPageSources,
      };

      return NextResponse.json({
        status: "complete",
        analysis,
      } satisfies AnalyzeResponse);
    }

    // Unknown tool
    return NextResponse.json(
      { error: `Unexpected tool: ${toolUse.name}` },
      { status: 502 }
    );
  } catch (err) {
    console.error("[ai-analyze] Claude API error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI analysis failed",
      },
      { status: 502 }
    );
  }
}
