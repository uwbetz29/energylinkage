// Prompt construction for AI-powered cross-page composite analysis

import type { AnalyzeRequest } from "@/types/composite";

export function buildCompositeSystemPrompt(): string {
  return `You are a technical drawing analyst for EnergyLink FLEX, a tool for adapting SCR/CO catalyst system drawings for gas turbine exhaust systems.

DOMAIN CONTEXT:
These drawings depict Selective Catalytic Reduction (SCR) and CO oxidation systems for gas turbine exhaust. The systems are complex multi-component assemblies that appear across multiple drawing pages — typically elevation views, plan views, section details, and bill-of-materials.

COMPONENT TYPES:
- Stack (4000 Series): Vertical cylindrical section for exhaust discharge. Shown as a tall rectangle in side/elevation views, circle in plan views.
- Silencer: Acoustic treatment modules within the stack or duct. Box-shaped in side views.
- Gas Path: Horizontal rectangular ducts connecting components.
- D.I. Duct (1000 Series): Distribution Inlet duct.
- T.A. Duct (1100 Series): Turning/Tempering Air duct.
- Distribution Grid Duct (2000 Series): Houses the distribution grid.
- SCR Duct (3100 Series): Houses the SCR catalyst modules.
- Inside Liner: Insulation lining within ducts and the stack.
- Nozzles (N1-N16): Pipe connections at various angles. Shown as circles or flanged stubs.
- Platforms: Access walkways and maintenance platforms.
- Ladders: Vertical access ladders.

DRAWING CONVENTIONS:
- Dimensions use imperial format: ft'-in" with fractions (e.g., 45'-0 1/2")
- Multiple pages typically show the same system from different views:
  - Page 1: Front/Side elevation (primary dimensions)
  - Page 2: Rear/opposite elevation or plan view
  - Page 3: Detail sections, nozzle schedules, or BOM
- The same physical component appears on multiple pages but may be labeled differently or shown at different scales
- Component numbers (e.g., "4000", "3100") are consistent identifiers across pages

YOUR TASK:
Analyze the component and dimension summaries from multiple pages/files of a drawing set. Identify:
1. Which components on different pages represent the SAME physical component
2. Which dimensions on different pages measure the SAME physical property
3. How dimension changes should propagate across pages

MATCHING STRATEGIES:
- Text label matching: "4000 STACK" on page 1 = "STACK" on page 2
- Component number matching: "1000" series = D.I. Duct across all pages
- Spatial/geometric matching: Similar bounding box proportions in same relative position
- Dimension value matching: Same numeric value on different pages likely measures the same thing
- Direction matching: A vertical dimension of 45'-0" on page 1 and page 2 both measure stack height

CONFIDENCE LEVELS:
- Mark matches as "identical" when you're confident (same label, same value, same direction)
- Mark as "derived" when one view shows a scaled or projected version (e.g., half-section detail)
- If uncertain, use the ask_clarification tool to ask the user

IMPORTANT:
- Return your analysis using the composite_analysis tool when confident
- Use ask_clarification if you need more information from the user
- Every component ID and dimension ID you reference must exist in the provided summaries
- Be conservative — only link components/dimensions you're reasonably confident about
- Provide brief but clear descriptions for page sources and component identities`;
}

export function buildCompositeUserMessage(request: AnalyzeRequest): string {
  let msg = "";

  // Prepend user-provided context if available
  if (request.projectContext || (request.fileDescriptions && request.fileDescriptions.length > 0)) {
    msg += `USER-PROVIDED CONTEXT:\n`;
    if (request.projectContext) {
      msg += `Description: ${request.projectContext}\n`;
    }
    if (request.fileDescriptions && request.fileDescriptions.length > 0) {
      msg += `\nFile descriptions:\n`;
      for (const fd of request.fileDescriptions) {
        if (fd.description.trim()) {
          msg += `  - ${fd.fileName}: "${fd.description}"\n`;
        }
      }
    }
    msg += `\n---\n\n`;
  }

  msg += `DRAWING SET ANALYSIS REQUEST\n\n`;
  msg += `Total pages: ${request.pageSummaries.length}\n\n`;

  for (const page of request.pageSummaries) {
    msg += `--- PAGE: ${page.pageSource} (${page.fileName}, page ${page.pageNumber}) ---\n`;
    msg += `Total entities: ${page.entityCount}\n\n`;

    if (page.components.length > 0) {
      msg += `  Components (${page.components.length}):\n`;
      for (const c of page.components) {
        msg += `    - [${c.id}] "${c.name}" (${c.type}), bounds: (${c.boundingBox.min.x.toFixed(0)},${c.boundingBox.min.y.toFixed(0)})-(${c.boundingBox.max.x.toFixed(0)},${c.boundingBox.max.y.toFixed(0)}), ${c.entityCount} entities\n`;
      }
    } else {
      msg += `  Components: none detected\n`;
    }

    if (page.dimensions.length > 0) {
      msg += `  Dimensions (${page.dimensions.length}):\n`;
      for (const d of page.dimensions) {
        msg += `    - [${d.id}] "${d.displayText}" = ${d.value.toFixed(2)} (${d.direction}, conf: ${d.confidence.toFixed(2)})\n`;
      }
    } else {
      msg += `  Dimensions: none detected\n`;
    }

    if (page.textLabels.length > 0) {
      msg += `  Text labels: ${page.textLabels.slice(0, 30).join(", ")}${page.textLabels.length > 30 ? ` ...(${page.textLabels.length} total)` : ""}\n`;
    }

    msg += `\n`;
  }

  // Add clarification answers if present
  if (request.clarificationAnswers && request.clarificationAnswers.length > 0) {
    msg += `\nUSER ANSWERS TO YOUR QUESTIONS:\n`;
    for (const ans of request.clarificationAnswers) {
      msg += `  Q[${ans.questionId}]: ${ans.answer}\n`;
    }
  }

  return msg;
}

/** Tool schema for returning the composite analysis */
export const COMPOSITE_ANALYSIS_TOOL = {
  name: "composite_analysis",
  description:
    "Return the cross-page component identity mapping and dimension linking analysis",
  input_schema: {
    type: "object" as const,
    required: ["components", "dimensionLinks", "pageSources"],
    properties: {
      components: {
        type: "array" as const,
        description: "Canonical component identities spanning multiple pages",
        items: {
          type: "object" as const,
          required: ["id", "canonicalName", "type", "pageAppearances"],
          properties: {
            id: { type: "string" as const },
            canonicalName: {
              type: "string" as const,
              description: 'E.g., "4000 Stack"',
            },
            type: {
              type: "string" as const,
              enum: [
                "stack", "silencer", "gas-path", "di-duct", "ta-duct",
                "dist-grid-duct", "scr-duct", "inside-liner", "nozzle",
                "platform", "ladder", "unknown",
              ],
            },
            pageAppearances: {
              type: "object" as const,
              description:
                'Map from page source ID to array of local component IDs. E.g., {"pdf:1": ["comp_1"], "pdf:2": ["comp_101"]}',
              additionalProperties: {
                type: "array" as const,
                items: { type: "string" as const },
              },
            },
            description: {
              type: "string" as const,
              description: "Brief description of this component's role",
            },
          },
        },
      },
      dimensionLinks: {
        type: "array" as const,
        description: "Cross-page dimension relationships",
        items: {
          type: "object" as const,
          required: ["id", "componentIdentityId", "label", "property", "instances"],
          properties: {
            id: { type: "string" as const },
            componentIdentityId: {
              type: "string" as const,
              description: "ID of the ComponentIdentity this dimension belongs to",
            },
            label: {
              type: "string" as const,
              description: 'Human-readable label, e.g., "Stack Height"',
            },
            property: {
              type: "string" as const,
              description: 'Physical property measured, e.g., "height", "diameter"',
            },
            instances: {
              type: "array" as const,
              items: {
                type: "object" as const,
                required: ["pageSource", "dimensionId", "relationship"],
                properties: {
                  pageSource: { type: "string" as const },
                  dimensionId: { type: "string" as const },
                  relationship: {
                    type: "string" as const,
                    enum: ["identical", "derived"],
                  },
                  derivationFormula: {
                    type: "string" as const,
                    description:
                      'For derived relationships, e.g., "value * 0.5" for half-scale',
                  },
                },
              },
            },
          },
        },
      },
      pageSources: {
        type: "array" as const,
        description: "Metadata about each page in the composite",
        items: {
          type: "object" as const,
          required: ["id", "drawingId", "pageNumber", "label"],
          properties: {
            id: { type: "string" as const },
            drawingId: { type: "string" as const },
            pageNumber: { type: "number" as const },
            label: { type: "string" as const },
            description: {
              type: "string" as const,
              description: "What this page shows (e.g., 'Front elevation')",
            },
          },
        },
      },
    },
  },
};

/** Tool schema for asking the user clarifying questions */
export const ASK_CLARIFICATION_TOOL = {
  name: "ask_clarification",
  description:
    "Ask the user clarifying questions before finalizing the cross-page analysis",
  input_schema: {
    type: "object" as const,
    required: ["questions"],
    properties: {
      questions: {
        type: "array" as const,
        description: "Questions to ask the user",
        items: {
          type: "object" as const,
          required: ["id", "question", "context"],
          properties: {
            id: {
              type: "string" as const,
              description: "Unique question ID for tracking answers",
            },
            question: {
              type: "string" as const,
              description: "The question to ask",
            },
            context: {
              type: "string" as const,
              description: "Why this question matters for the analysis",
            },
            options: {
              type: "array" as const,
              description: "Optional multiple-choice options",
              items: { type: "string" as const },
            },
          },
        },
      },
    },
  },
};
