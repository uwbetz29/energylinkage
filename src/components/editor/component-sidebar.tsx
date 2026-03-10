"use client";

import { useEditorStore } from "@/stores/editor-store";
import { Check, AlertTriangle, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";

export function ComponentSidebar() {
  const {
    components,
    selectedId,
    originals,
    changeCount,
    select,
    updateDim,
    quickAdjust,
    resetComp,
  } = useEditorStore();

  const selected = selectedId ? components[selectedId] : null;
  const compList = Object.values(components);
  const compOriginals = selectedId ? originals[selectedId] : undefined;

  return (
    <div className="w-[340px] flex-shrink-0 bg-white flex flex-col overflow-hidden z-20 shadow-[-4px_0_30px_rgba(0,0,0,0.15)]">
      {/* Header */}
      <div className="px-[18px] py-3.5 border-b border-[rgba(0,60,160,0.08)] flex items-center justify-between bg-[#fafbfd]">
        <span className="text-[11px] font-bold text-[#a5b8d4] uppercase tracking-[0.8px]">
          {selected ? selected.name : `Components — ${compList.length} Detected`}
        </span>
        {selected && (
          <button
            onClick={() => select(null)}
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center
                       text-[#a5b8d4] hover:bg-[#e6eeff] hover:text-[#002e81] transition-colors text-sm"
          >
            ✕
          </button>
        )}
        {!selected && changeCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#002e81] text-white">
            {changeCount} change{changeCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <SelectedDetail
            comp={selected}
            originals={compOriginals}
            onDimChange={(key, val) => updateDim(selected.id, key, val)}
            onQuickAdjust={(delta) => quickAdjust(selected.id, delta)}
            onReset={() => resetComp(selected.id)}
            onSelectDownstream={(id) => select(id)}
            components={components}
          />
        ) : (
          <ComponentList
            components={compList}
            onSelect={(id) => select(id)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Component List ─── */

function ComponentList({
  components,
  onSelect,
}: {
  components: { id: string; name: string; color: string; dims: Record<string, string>; mainDim: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      {components.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="w-full flex items-center gap-2.5 px-[18px] py-2.5 text-left cursor-pointer
                     border-b border-[rgba(0,60,160,0.03)] hover:bg-[#eef3ff] transition-colors"
        >
          <div
            className="w-2 h-2 rounded-sm flex-shrink-0"
            style={{ background: c.color }}
          />
          <span className="text-[12px] font-semibold text-[#001a4d] flex-1">{c.name}</span>
          <span className="text-[10px] text-[#a5b8d4] font-medium">{c.dims[c.mainDim]}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Selected Detail ─── */

function SelectedDetail({
  comp,
  originals,
  onDimChange,
  onQuickAdjust,
  onReset,
  onSelectDownstream,
  components,
}: {
  comp: any;
  originals?: Record<string, string>;
  onDimChange: (key: string, val: string) => void;
  onQuickAdjust: (delta: number) => void;
  onReset: () => void;
  onSelectDownstream: (id: string) => void;
  components: Record<string, any>;
}) {
  const hasChanges = originals && Object.keys(originals).length > 0;

  return (
    <>
      {/* Component header */}
      <div className="flex items-center gap-3 px-[18px] pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-[11px] flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: `${comp.color}12`, color: comp.color }}
        >
          {comp.icon}
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#001a4d]">{comp.name}</h3>
          <p className="text-[11px] text-[#a5b8d4] mt-0.5">{comp.type}</p>
        </div>
      </div>

      {/* Dimensions */}
      <div className="px-[18px] py-3.5 border-b border-[rgba(0,60,160,0.05)]">
        <div className="text-[10px] font-bold text-[#a5b8d4] uppercase tracking-[1px] mb-2">
          Dimensions
        </div>
        {Object.entries(comp.dims).map(([key, val]) => {
          const isChanged = originals?.[key] && originals[key] !== val;
          return (
            <div key={key} className="flex items-center gap-2 py-1.5">
              <span className="text-[12px] text-[#666] w-[55px] flex-shrink-0 font-medium capitalize">
                {key}
              </span>
              <input
                type="text"
                defaultValue={val as string}
                onBlur={(e) => onDimChange(key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onDimChange(key, (e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`flex-1 px-2 py-1.5 rounded-[7px] border-[1.5px] text-[13px] font-semibold
                           text-center text-[#001a4d] transition-all focus:outline-none
                           focus:border-[#1a5cb8] focus:shadow-[0_0_0_3px_rgba(0,46,129,0.1)] ${
                             isChanged
                               ? "bg-[#e6eeff] border-[#1a5cb8]"
                               : "bg-white border-[rgba(0,60,160,0.12)]"
                           }`}
              />
            </div>
          );
        })}

        {/* Quick-adjust buttons */}
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {[
            { label: "+2'", delta: 2 },
            { label: "+1'", delta: 1 },
            { label: '+6"', delta: 0.5 },
            { label: "−1'", delta: -1, neg: true },
            { label: "−2'", delta: -2, neg: true },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => onQuickAdjust(btn.delta)}
              className={`px-2 py-1 rounded-[5px] border text-[11px] font-semibold transition-all ${
                btn.neg
                  ? "text-red-500 border-red-100 hover:bg-red-50 hover:border-red-300"
                  : "text-[#4a7ab8] border-[rgba(0,60,160,0.1)] hover:bg-[#e6eeff] hover:border-[#1a5cb8] hover:text-[#002e81]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cascade effect */}
      {comp.downstream.length > 0 && (
        <div className="px-[18px] py-3.5 border-b border-[rgba(0,60,160,0.05)]">
          <div className="text-[10px] font-bold text-[#a5b8d4] uppercase tracking-[1px] mb-2">
            Cascade Effect
          </div>
          <div className="bg-[#eef3ff] border border-[rgba(0,60,160,0.08)] rounded-[10px] p-2.5">
            <div className="text-[10px] font-bold text-[#002e81] uppercase tracking-[0.5px] mb-1.5">
              ↻ Downstream shift preview
            </div>
            {comp.downstream.slice(0, 4).map((dId: string) => {
              const d = components[dId];
              if (!d) return null;
              return (
                <button
                  key={dId}
                  onClick={() => onSelectDownstream(dId)}
                  className="w-full flex items-center gap-1.5 text-[11px] text-[#555] py-1 hover:text-[#002e81] transition-colors"
                >
                  <ChevronUp className="w-3 h-3 text-[#1a5cb8]" />
                  <span>{d.name}</span>
                  <span className="ml-auto text-[10px] font-bold text-[#002e81]">
                    shifts with change
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Constraints */}
      <div className="px-[18px] py-3.5 border-b border-[rgba(0,60,160,0.05)]">
        <div className="text-[10px] font-bold text-[#a5b8d4] uppercase tracking-[1px] mb-2">
          Constraints
        </div>
        {comp.constraints.map(
          (c: { label: string; value: string; ok: boolean }, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <div
                className={`w-[17px] h-[17px] rounded-full flex items-center justify-center flex-shrink-0 ${
                  c.ok ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                }`}
              >
                {c.ok ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <AlertTriangle className="w-2.5 h-2.5" />
                )}
              </div>
              <span className="text-[12px] text-[#666] flex-1">{c.label}</span>
              <span className="text-[11px] font-semibold text-[#333]">{c.value}</span>
            </div>
          )
        )}
      </div>

      {/* Construction notes */}
      <div className="px-[18px] py-3.5 border-b border-[rgba(0,60,160,0.05)]">
        <div className="text-[10px] font-bold text-[#a5b8d4] uppercase tracking-[1px] mb-2">
          Construction Notes
        </div>
        <p className="text-[11px] text-[#666] leading-relaxed">{comp.notes}</p>
      </div>

      {/* Reset button */}
      {hasChanges && (
        <div className="px-[18px] py-3.5">
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[9px]
                       border border-[rgba(0,60,160,0.15)] text-[12px] font-semibold
                       text-[#002e81] hover:bg-[#e6eeff] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Original
          </button>
        </div>
      )}
    </>
  );
}
