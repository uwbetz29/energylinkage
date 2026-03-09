// Prompt construction for AI-powered dimension resizing

import type { AIResizeRequest } from "@/types/ai-resize";

export function buildSystemPrompt(): string {
  return `You are a CAD dimension resize assistant for EnergyLink FLEX, a tool for adapting SCR/CO catalyst system drawings for gas turbine exhaust systems.

DOMAIN CONTEXT:
Components include Stacks (vertical cylindrical sections shown as side-view rectangles), Silencers (acoustic treatment boxes), Gas Paths (horizontal rectangular ducts), D.I. Ducts (distribution inlet), T.A. Ducts (turning/transition), Distribution Grid Ducts, SCR Ducts, Inside Liners, Nozzles (pipe connections at various angles, shown as circles or flanged stubs), Platforms, and Ladders.

In 2D side-view drawings, a cylindrical stack appears as a vertical rectangle. The "diameter" dimension corresponds to the horizontal width of that rectangle. The "height" dimension corresponds to the vertical extent.

YOUR TASK:
Given a dimension change (old value → new value) on a specific component, determine exactly how to transform the component's entities to achieve the desired resize. You MUST return transforms using the apply_resize_transforms tool.

RESIZE RULES BY COMPONENT TYPE:

1. STACK HEIGHT CHANGE (vertical dimension on a stack):
   - Determine which entities are ABOVE the dimension's midpoint vs BELOW.
   - Keep the BOTTOM entities fixed (anchor at base).
   - TRANSLATE top entities vertically by the delta (newValue - oldValue).
   - Do NOT scale horizontal dimensions — the diameter stays the same.
   - Nozzles and features on the stack wall should shift proportionally based on their relative vertical position.

2. STACK/DUCT DIAMETER CHANGE (horizontal dimension):
   - Scale entities horizontally (along X axis) relative to the center of the component.
   - Keep vertical positions unchanged — height does not change.
   - The two vertical side-wall lines move outward/inward symmetrically.
   - Nozzles on the walls shift horizontally with the walls.

3. DUCT LENGTH CHANGE (dimension along the duct's primary axis):
   - Similar to stack height — translate entities along the duct axis.
   - Keep the cross-section shape unchanged.
   - Shift downstream entities by the delta.

4. NOZZLE DIAMETER:
   - Scale the nozzle's circular geometry (radius change).
   - The connection point to the main body stays fixed.
   - Only affects the nozzle entities, not the parent component.

5. SILENCER HEIGHT/WIDTH:
   - Height change: shift top panel vertically, bottom stays fixed.
   - Width change: scale side panels horizontally from center.

6. GENERAL PRINCIPLES:
   - "Chop and shift" (translate) is ALMOST ALWAYS preferred over proportional scaling for height/length changes.
   - Only use scale_axis when the dimension truly represents a diameter or width change.
   - Annotations (extension lines, dimension arrows) should move with their associated geometry.
   - The dimension text entity should be repositioned to the midpoint of the new dimension span.
   - TEXT and MTEXT entities that are labels (not dimensions) should translate with their parent geometry.

TRANSFORM OPERATIONS:
- translate: Move entity by (dx, dy). Use for shifting entities up/down/left/right.
- scale_axis: Scale entity along a specific axis relative to a pivot. Use for diameter/width changes.
- set_vertices: Replace all vertices. Use sparingly for complex reshaping only.

IMPORTANT:
- Every entity handle you reference MUST exist in the provided entity list.
- Include transforms for annotation entities that need to move with geometry.
- Prefer minimal transforms — only transform entities that actually need to change.
- Provide clear reasoning explaining your approach in 1-2 sentences.`;
}

export function buildUserMessage(request: AIResizeRequest): string {
  const { dimension, component, entities, userInstruction } = request;

  const delta = dimension.newValue - dimension.value;

  let msg = `DIMENSION CHANGE:
- Text: "${dimension.displayText}" (${dimension.direction})
- Current: ${dimension.value.toFixed(2)} inches (${fmtFtIn(dimension.value)})
- New: ${dimension.newValue.toFixed(2)} inches (${fmtFtIn(dimension.newValue)})
- Delta: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} inches
- Anchors: [${fmtPt(dimension.anchorPoints[0])}, ${fmtPt(dimension.anchorPoints[1])}]
- Expand: ${dimension.expandDirection}
- Geometry handles: [${dimension.geometryHandles.join(", ")}]
- Annotation handles: [${dimension.annotationHandles.join(", ")}]
- Text handle: ${dimension.textHandle}`;

  if (component) {
    msg += `

COMPONENT:
- Name: ${component.name}
- Type: ${component.type}
- Bounds: min=${fmtPt(component.boundingBox.min)}, max=${fmtPt(component.boundingBox.max)}
- Entity count: ${component.entityHandles.length}`;
  }

  msg += `

ENTITIES (${entities.length}):`;
  for (const e of entities) {
    let desc = `[${e.handle}] ${e.type} layer="${e.layer}"`;
    if (e.vertices) {
      const pts = e.vertices.slice(0, 8).map(fmtPt).join(", ");
      desc += ` verts=[${pts}${e.vertices.length > 8 ? `, ...(${e.vertices.length})` : ""}]`;
    }
    if (e.center) desc += ` center=${fmtPt(e.center)}`;
    if (e.radius !== undefined) desc += ` r=${e.radius.toFixed(2)}`;
    if (e.text) desc += ` text="${e.text.slice(0, 40)}"`;
    if (e.insertionPoint) desc += ` pos=${fmtPt(e.insertionPoint)}`;
    msg += `\n  ${desc}`;
  }

  if (userInstruction) {
    msg += `

USER INSTRUCTION: "${userInstruction}"`;
  }

  return msg;
}

function fmtPt(p: { x: number; y: number }): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
}

function fmtFtIn(inches: number): string {
  const ft = Math.floor(Math.abs(inches) / 12);
  const rem = Math.abs(inches) - ft * 12;
  return `${inches < 0 ? "-" : ""}${ft}'-${rem.toFixed(1)}"`;
}

export const TOOL_SCHEMA = {
  name: "apply_resize_transforms",
  description: "Apply entity transforms to resize a CAD component dimension",
  input_schema: {
    type: "object" as const,
    required: ["transforms", "reasoning"],
    properties: {
      reasoning: {
        type: "string" as const,
        description: "Brief explanation of the resize approach (1-2 sentences)",
      },
      transforms: {
        type: "array" as const,
        description: "Entity transform operations to apply",
        items: {
          type: "object" as const,
          required: ["handle", "op"],
          properties: {
            handle: { type: "string" as const, description: "Entity handle" },
            op: {
              type: "string" as const,
              enum: ["translate", "scale_axis", "set_vertices"],
            },
            dx: { type: "number" as const },
            dy: { type: "number" as const },
            pivot: {
              type: "object" as const,
              properties: {
                x: { type: "number" as const },
                y: { type: "number" as const },
              },
            },
            axis: {
              type: "object" as const,
              properties: {
                x: { type: "number" as const },
                y: { type: "number" as const },
              },
            },
            factor: { type: "number" as const },
            vertices: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  x: { type: "number" as const },
                  y: { type: "number" as const },
                },
              },
            },
          },
        },
      },
    },
  },
};
