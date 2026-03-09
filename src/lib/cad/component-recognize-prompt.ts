// AI Component Recognition Prompt
// Builds the system prompt and user message for Claude to identify
// SCR/CO system components from drawing geometry summaries.

import type { GeometrySummary } from "@/types/component-recognition";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export function buildRecognitionSystemPrompt(): string {
  return `You are an expert engineering drawing analyst specializing in SCR/CO catalyst systems for gas turbine exhaust.

You are given a summary of an engineering drawing including text labels, spatial regions, and dimension measurements. Your job is to identify the major system components and their approximate locations.

## Component Types

These are the components typically found in SCR/CO catalyst system drawings:

- **stack**: The exhaust stack (often labeled "4000 STACK" or similar). Usually the tallest vertical component.
- **silencer**: Sound attenuation section. Often labeled "SILENCER" or with acoustic specs.
- **gas-path**: The main gas flow path from the turbine. May be labeled "GAS PATH" or "EXHAUST".
- **di-duct**: Diverter/inlet duct. Labeled "D.I. DUCT" or "DIVERTER INLET".
- **ta-duct**: Transition/adapter duct. Labeled "T.A. DUCT" or "TRANSITION".
- **dist-grid-duct**: Distribution grid duct. Labeled "DIST. GRID" or "DISTRIBUTION GRID".
- **scr-duct**: The SCR catalyst housing. Labeled "SCR DUCT", "SCR", or "CATALYST".
- **inside-liner**: Internal liner within a duct. Labeled "INSIDE LINER" or "LINER".
- **nozzle**: Connection points (N1-N16). Labeled with "N" prefix and number.
- **platform**: Access platforms and walkways. Labeled "PLATFORM" or "ACCESS".
- **ladder**: Access ladders. Labeled "LADDER".

## Typical Flow Order (gas turbine exhaust path)

Turbine → Gas Path → D.I. Duct → T.A. Duct → Dist. Grid → SCR Duct → Silencer → Stack

Components are typically arranged either:
- Left-to-right (horizontal flow)
- Bottom-to-top (vertical flow, most common for stacks)

## Instructions

1. Examine the text labels to identify component names and their positions
2. Use the spatial regions to estimate bounding boxes
3. Use dimensions to infer component sizes
4. Assign a confidence level (0-1) to each identification
5. Determine the overall gas flow direction
6. If you cannot identify a component, use type "unknown"

Be conservative with confidence scores. Only assign high confidence (>0.8) when text labels clearly match a known component type.`;
}

export function buildRecognitionUserMessage(
  summary: GeometrySummary,
  drawingBounds: { minX: number; minY: number; maxX: number; maxY: number }
): string {
  const parts: string[] = [];

  parts.push(`## Drawing Bounds
minX: ${drawingBounds.minX.toFixed(1)}, minY: ${drawingBounds.minY.toFixed(1)}
maxX: ${drawingBounds.maxX.toFixed(1)}, maxY: ${drawingBounds.maxY.toFixed(1)}
Width: ${(drawingBounds.maxX - drawingBounds.minX).toFixed(1)}, Height: ${(drawingBounds.maxY - drawingBounds.minY).toFixed(1)}`);

  if (summary.textLabels.length > 0) {
    parts.push(`\n## Text Labels (${summary.textLabels.length} found)`);
    for (const label of summary.textLabels.slice(0, 60)) {
      parts.push(`- "${label.text}" at (${label.position.x.toFixed(1)}, ${label.position.y.toFixed(1)}) h=${label.height.toFixed(1)}`);
    }
  }

  if (summary.regions.length > 0) {
    parts.push(`\n## Spatial Regions (entity density)`);
    for (const region of summary.regions) {
      parts.push(`- ${region.id}: [${region.bounds.minX.toFixed(0)},${region.bounds.minY.toFixed(0)} → ${region.bounds.maxX.toFixed(0)},${region.bounds.maxY.toFixed(0)}] ${region.entityCount} entities (${region.dominantTypes.join(", ")})`);
    }
  }

  if (summary.dimensionSummary.length > 0) {
    parts.push(`\n## Dimensions (${summary.dimensionSummary.length} found)`);
    for (const dim of summary.dimensionSummary.slice(0, 40)) {
      parts.push(`- ${dim.displayText} (${dim.direction}) at (${dim.midpoint.x.toFixed(1)}, ${dim.midpoint.y.toFixed(1)})`);
    }
  }

  parts.push(`\nIdentify the components in this drawing using the recognize_components tool.`);

  return parts.join("\n");
}

export const RECOGNIZE_TOOL_SCHEMA: Tool = {
  name: "recognize_components",
  description: "Identify SCR/CO system components in the engineering drawing and their spatial relationships.",
  input_schema: {
    type: "object" as const,
    properties: {
      components: {
        type: "array",
        description: "List of identified components",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique ID for this component (e.g., 'comp-stack-1')" },
            type: {
              type: "string",
              enum: ["stack", "silencer", "gas-path", "di-duct", "ta-duct", "dist-grid-duct", "scr-duct", "inside-liner", "nozzle", "platform", "ladder", "unknown"],
              description: "Component type",
            },
            label: { type: "string", description: "Display label (e.g., '4000 Stack')" },
            boundingBox: {
              type: "object",
              properties: {
                minX: { type: "number" },
                minY: { type: "number" },
                maxX: { type: "number" },
                maxY: { type: "number" },
              },
              required: ["minX", "minY", "maxX", "maxY"],
            },
            confidence: { type: "number", description: "Confidence 0-1" },
          },
          required: ["id", "type", "label", "boundingBox", "confidence"],
        },
      },
      flowDirection: {
        type: "string",
        enum: ["left-to-right", "right-to-left", "bottom-to-top", "top-to-bottom"],
        description: "Overall gas flow direction in the drawing",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of how components were identified",
      },
    },
    required: ["components", "flowDirection", "reasoning"],
  },
};
