"use client";

import { useEditorStore, type Stage } from "@/stores/editor-store";

const STAGES: { id: Stage; label: string; num: string }[] = [
  { id: "import", label: "Import", num: "1" },
  { id: "configure", label: "Configure", num: "2" },
  { id: "review", label: "Review", num: "3" },
  { id: "export", label: "Export", num: "4" },
];

export function StageNav() {
  const { stage, setStage } = useEditorStore();
  const stageIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="flex gap-0.5 bg-black/25 rounded-[10px] p-[3px]">
      {STAGES.map((s, i) => {
        const isDone = i < stageIdx;
        const isActive = s.id === stage;
        return (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
              isActive
                ? "bg-white/14 text-white"
                : isDone
                  ? "text-white/50"
                  : "text-white/35 hover:text-white/70"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-[17px] h-[17px] rounded-full
                          text-[10px] font-bold mr-1.5 ${
                            isDone
                              ? "bg-green-500 text-white"
                              : isActive
                                ? "bg-white/25"
                                : "bg-white/10"
                          }`}
            >
              {isDone ? "✓" : s.num}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
