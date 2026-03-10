"use client";

import { useState, useRef } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { Zap, ArrowUp } from "lucide-react";

export function NLBar() {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { components, select, quickAdjust } = useEditorStore();

  function handleSubmit() {
    const text = value.trim().toLowerCase();
    if (!text) return;

    // Simple NL parsing — will be replaced by AI later
    const compMap: Record<string, string> = {
      scr: "scr-module",
      catalyst: "scr-module",
      stack: "stack",
      silencer: "silencer",
      duct: "transition-duct",
      transition: "transition-duct",
      grid: "dist-grid",
      distribution: "dist-grid",
      turbine: "turbine-outlet",
      outlet: "turbine-outlet",
      expansion: "inlet-exp",
    };

    // Find component
    let matchedId: string | null = null;
    for (const [keyword, id] of Object.entries(compMap)) {
      if (text.includes(keyword) && components[id]) {
        matchedId = id;
        break;
      }
    }

    // Find delta
    const deltaMatch = text.match(/(\d+)\s*(foot|feet|ft|')/);
    const isTaller =
      text.includes("taller") ||
      text.includes("extend") ||
      text.includes("increase") ||
      text.includes("raise") ||
      text.includes("add");
    const isShorter =
      text.includes("shorter") ||
      text.includes("reduce") ||
      text.includes("decrease") ||
      text.includes("lower") ||
      text.includes("shrink");

    if (matchedId) {
      select(matchedId);
      if (deltaMatch) {
        const delta = parseInt(deltaMatch[1]);
        const sign = isShorter ? -1 : 1;
        quickAdjust(matchedId, delta * sign);
      }
    }

    setValue("");
  }

  return (
    <div className="h-12 bg-white border-t border-[rgba(0,60,160,0.06)] flex items-center px-3.5 gap-2.5 flex-shrink-0">
      <div
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #1a5cb8, #002e81)",
        }}
      >
        <Zap className="w-3.5 h-3.5 text-white" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder='Try: "make the SCR module 2 feet taller"'
        className="flex-1 border-none outline-none text-[13px] text-[#333] bg-transparent placeholder:text-[#bbb]"
      />
      <span className="text-[10px] text-[#ccc] whitespace-nowrap">
        Enter to send
      </span>
      <button
        onClick={handleSubmit}
        className="w-[30px] h-[30px] rounded-[7px] bg-[#002e81] text-white flex items-center justify-center
                   hover:bg-[#0a3d99] transition-colors flex-shrink-0"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
