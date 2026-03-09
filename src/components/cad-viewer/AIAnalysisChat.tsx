"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, MessageCircle, Send, Sparkles, SkipForward } from "lucide-react";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisMessage,
  ClarificationQuestion,
  CompositeAnalysis,
  PageSummary,
} from "@/types/composite";

interface AIAnalysisChatProps {
  pageSummaries: PageSummary[];
  onComplete: (analysis: CompositeAnalysis) => void;
  onSkip: () => void;
  projectContext?: string;
  fileDescriptions?: Array<{ fileName: string; description: string }>;
}

type AnalysisStatus = "idle" | "analyzing" | "asking" | "complete" | "error";

export function AIAnalysisChat({
  pageSummaries,
  onComplete,
  onSkip,
  projectContext,
  fileDescriptions,
}: AIAnalysisChatProps) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompositeAnalysis | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, questions, status]);

  // Start analysis automatically on mount
  useEffect(() => {
    if (status === "idle" && pageSummaries.length > 0) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = async (
    clarificationAnswers?: Array<{ questionId: string; answer: string }>
  ) => {
    setStatus("analyzing");
    setError(null);

    try {
      const requestBody: AnalyzeRequest = {
        pageSummaries,
        messages: messages.length > 0 ? messages : undefined,
        clarificationAnswers,
        projectContext,
        fileDescriptions,
      };

      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Analysis failed: ${res.status}`);
      }

      const response: AnalyzeResponse = await res.json();

      if (response.status === "needs_clarification") {
        // AI has questions for the user
        setQuestions(response.questions);
        setAnswers({});

        // Add AI message to chat
        const questionText = response.questions
          .map((q) => q.question)
          .join("\n\n");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: questionText },
        ]);
        setStatus("asking");
      } else if (response.status === "complete") {
        // Analysis complete
        setAnalysis(response.analysis);
        const summary = buildCompletionSummary(response.analysis);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: summary },
        ]);
        setStatus("complete");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Analysis failed";
      setError(errMsg);
      setStatus("error");
    }
  };

  const handleSubmitAnswers = () => {
    // Build answers array from the answers state
    const clarificationAnswers = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] || "(no answer)",
    }));

    // Add user answers to chat
    const answerText = questions
      .map((q) => `${q.question}\n→ ${answers[q.id] || "(no answer)"}`)
      .join("\n\n");
    setMessages((prev) => [...prev, { role: "user", content: answerText }]);

    setQuestions([]);
    runAnalysis(clarificationAnswers);
  };

  const handleAccept = () => {
    if (analysis) {
      onComplete(analysis);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[#93C90F]" />
        <h3 className="text-sm font-semibold text-[#0C121D]">
          AI Drawing Analysis
        </h3>
      </div>

      {/* Status banner */}
      {status === "analyzing" && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F0F7E3] border border-[#C5D99B]">
          <Loader2 className="w-5 h-5 text-[#93C90F] animate-spin flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-[#0C121D]">
              Analyzing {pageSummaries.length} page
              {pageSummaries.length !== 1 ? "s" : ""}...
            </div>
            <div className="text-xs text-[#999] mt-0.5">
              Identifying components and linking dimensions across pages
            </div>
          </div>
        </div>
      )}

      {status === "complete" && analysis && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
            <Check className="w-4 h-4" />
            Analysis Complete
          </div>
          <div className="text-xs text-green-600 mt-1">
            Found {analysis.components.length} component
            {analysis.components.length !== 1 ? "s" : ""} across{" "}
            {analysis.pageSources.length} page
            {analysis.pageSources.length !== 1 ? "s" : ""},{" "}
            {analysis.dimensionLinks.length} linked dimension
            {analysis.dimensionLinks.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-[200px] overflow-y-auto p-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-[#93C90F]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#93C90F]" />
                </div>
              )}
              <div
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#F0F0F0] text-[#0C121D]"
                    : "bg-[#FAFAFA] text-[#0C121D]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Clarification questions */}
      {status === "asking" && questions.length > 0 && (
        <div className="space-y-3 border-t border-[#D4D4D4] pt-3">
          {questions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <div className="text-xs text-[#999] italic">{q.context}</div>
              {q.options && q.options.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                      }
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        answers[q.id] === opt
                          ? "border-[#93C90F] bg-[#93C90F]/20 text-[#0C121D]"
                          : "border-[#D4D4D4] text-[#666] hover:border-[#93C90F]/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <Input
                  value={answers[q.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder="Type your answer..."
                  className="h-8 text-sm"
                />
              )}
            </div>
          ))}

          <Button
            onClick={handleSubmitAnswers}
            disabled={questions.some((q) => !answers[q.id])}
            className="w-full bg-[#93C90F] hover:bg-[#7AB00D] text-white"
            size="sm"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit Answers
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {status === "complete" && (
          <Button
            onClick={handleAccept}
            className="flex-1 bg-[#93C90F] hover:bg-[#7AB00D] text-white"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Accept & Continue
          </Button>
        )}

        {status === "error" && (
          <Button
            onClick={() => runAnalysis()}
            variant="outline"
            className="flex-1"
          >
            Retry Analysis
          </Button>
        )}

        {(status === "error" || status === "asking") && (
          <Button onClick={onSkip} variant="outline" size="sm">
            <SkipForward className="w-3.5 h-3.5 mr-1" />
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

function buildCompletionSummary(analysis: CompositeAnalysis): string {
  const lines: string[] = ["Analysis complete! Here's what I found:\n"];

  if (analysis.components.length > 0) {
    lines.push(`Components identified (${analysis.components.length}):`);
    for (const comp of analysis.components) {
      const pageCount = Object.keys(comp.pageAppearances).length;
      lines.push(
        `  - ${comp.canonicalName} (${comp.type}) — appears on ${pageCount} page${pageCount !== 1 ? "s" : ""}`
      );
    }
  }

  if (analysis.dimensionLinks.length > 0) {
    lines.push(`\nCross-page dimension links (${analysis.dimensionLinks.length}):`);
    for (const link of analysis.dimensionLinks) {
      lines.push(
        `  - ${link.label}: ${link.instances.length} linked instance${link.instances.length !== 1 ? "s" : ""} (${link.property})`
      );
    }
  }

  if (analysis.pageSources.length > 0) {
    lines.push(`\nPages:`);
    for (const ps of analysis.pageSources) {
      lines.push(`  - ${ps.label}${ps.description ? `: ${ps.description}` : ""}`);
    }
  }

  return lines.join("\n");
}
