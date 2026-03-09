"use client";

import { useCADStore, type FileTab } from "@/lib/cad/store";
import { X, FileText, FileImage, Circle } from "lucide-react";

function TabItem({ tab, isActive }: { tab: FileTab; isActive: boolean }) {
  const { switchTab, closeTab } = useCADStore();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.isDirty) {
      if (!confirm(`Close "${tab.label}"? Unsaved changes will be lost.`)) {
        return;
      }
    }
    closeTab(tab.id);
  };

  return (
    <button
      className={`group flex items-center gap-1.5 h-8 px-3 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap max-w-[180px] ${
        isActive
          ? "border-[#93C90F] text-[#222] bg-white"
          : "border-transparent text-[#777] hover:text-[#444] hover:bg-[#F0F0F0]"
      }`}
      onClick={() => switchTab(tab.id)}
      title={`${tab.fileName} (Working Copy)`}
    >
      {tab.isPdf ? (
        <FileImage className="w-3 h-3 text-red-400 flex-shrink-0" />
      ) : (
        <FileText className="w-3 h-3 text-[#999] flex-shrink-0" />
      )}
      <span className="truncate">{tab.label}</span>
      {tab.isDirty && (
        <Circle className="w-1.5 h-1.5 fill-[#93C90F] text-[#93C90F] flex-shrink-0" />
      )}
      <span
        className="ml-0.5 p-0.5 rounded hover:bg-[#E0E0E0] text-[#999] hover:text-[#555] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={handleClose}
      >
        <X className="w-3 h-3" />
      </span>
    </button>
  );
}

export function TabBar() {
  const { tabs, activeTabId } = useCADStore();

  // Hide tab bar for v0 — single file per project
  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-end h-9 px-2 bg-[#F7F7F9] border-b border-[#E7E7E7] overflow-x-auto">
      {tabs.map((tab) => (
        <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
      ))}
    </div>
  );
}
