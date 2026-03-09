// Types for AI-powered cross-page composite analysis

import type { ComponentType } from "./cad";

/**
 * A canonical component identity — the "real" physical component
 * that may appear on multiple pages under different names/representations.
 */
export interface ComponentIdentity {
  /** Unique ID for this canonical component */
  id: string;
  /** Canonical name (e.g., "4000 Stack") */
  canonicalName: string;
  /** Component type from the domain ontology */
  type: ComponentType;
  /**
   * Where this component appears across pages.
   * Key: page source identifier (e.g., "pdf:1", "pdf:2", "dwg:0")
   * Value: the CADComponent IDs on that page that represent this physical component
   */
  pageAppearances: Record<string, string[]>;
  /** AI's description of this component's role */
  description?: string;
}

/**
 * A dimension relationship that spans pages.
 * When this dimension changes, the linked dimensions on other pages must also change.
 */
export interface CrossPageDimensionLink {
  /** Unique ID */
  id: string;
  /** The canonical component this dimension belongs to */
  componentIdentityId: string;
  /** Human-readable label (e.g., "Stack Height") */
  label: string;
  /** The physical property being measured (for AI reasoning) */
  property: string;
  /**
   * Dimension instances across pages.
   * Each entry maps a page source to the ParametricDimension ID on that page.
   */
  instances: Array<{
    pageSource: string; // e.g., "pdf:1"
    dimensionId: string; // ParametricDimension.id on that page
    relationship: "identical" | "derived";
    derivationFormula?: string; // e.g., "value * 0.5" for a half-section view
  }>;
}

/** Metadata about a page source in the composite project */
export interface CompositePageSource {
  /** Source identifier (e.g., "pdf:1", "dwg:0") */
  id: string;
  /** ProjectDrawing.id */
  drawingId: string;
  /** 1-based page number */
  pageNumber: number;
  /** Display label */
  label: string;
  /** AI's description of what this page shows */
  description?: string;
}

/**
 * The composite project model — stored in Project.data JSON field.
 */
export interface CompositeAnalysis {
  /** Version for future migration */
  version: 1;
  /** When the AI analysis was performed */
  analyzedAt: string;
  /** AI model used */
  model: string;
  /** Canonical component identities */
  components: ComponentIdentity[];
  /** Cross-page dimension links */
  dimensionLinks: CrossPageDimensionLink[];
  /** Page sources in the composite, maintaining order and metadata */
  pageSources: CompositePageSource[];
  /** AI conversation history ID for this analysis */
  conversationId?: string;
}

/** Message in the AI analysis conversation */
export interface AnalysisMessage {
  role: "user" | "assistant";
  content: string;
}

/** A clarification question from the AI */
export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  options?: string[];
}

/** Response from /api/ai-analyze when the AI needs clarification */
export interface AnalyzeNeedsClarification {
  status: "needs_clarification";
  questions: ClarificationQuestion[];
  /** Partial results gathered so far */
  partialAnalysis?: Partial<CompositeAnalysis>;
}

/** Response from /api/ai-analyze when analysis is complete */
export interface AnalyzeComplete {
  status: "complete";
  analysis: CompositeAnalysis;
}

/** Union type for /api/ai-analyze response */
export type AnalyzeResponse = AnalyzeNeedsClarification | AnalyzeComplete;

/** Summary of a single page sent to the AI for analysis */
export interface PageSummary {
  pageSource: string; // e.g., "pdf:1", "dwg:0"
  drawingId: string;
  fileName: string;
  pageNumber: number;
  components: Array<{
    id: string;
    name: string;
    type: string;
    boundingBox: { min: { x: number; y: number }; max: { x: number; y: number } };
    entityCount: number;
  }>;
  dimensions: Array<{
    id: string;
    displayText: string;
    value: number;
    direction: string;
    confidence: number;
  }>;
  textLabels: string[];
  entityCount: number;
}

/** Request body for /api/ai-analyze */
export interface AnalyzeRequest {
  pageSummaries: PageSummary[];
  /** Conversation history for multi-turn */
  messages?: AnalysisMessage[];
  /** User's answers to clarification questions */
  clarificationAnswers?: Array<{ questionId: string; answer: string }>;
}
