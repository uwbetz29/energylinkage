"use client";

import { useCADStore } from "@/lib/cad/store";
import { Link2 } from "lucide-react";

/**
 * Badge showing composite analysis status in the viewer.
 * Displays linked component/dimension counts when analysis exists.
 */
export function CompositeIndicator() {
  const { compositeAnalysis } = useCADStore();

  if (!compositeAnalysis) return null;

  const componentCount = compositeAnalysis.components.length;
  const linkCount = compositeAnalysis.dimensionLinks.length;
  const pageCount = compositeAnalysis.pageSources.length;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F7E3] border border-[#C5D99B] rounded-lg text-xs text-[#5A7D00]">
      <Link2 className="w-3.5 h-3.5 text-[#93C90F]" />
      <span className="font-medium">Composite</span>
      <span className="text-[#93C90F]/50">|</span>
      <span>
        {pageCount} page{pageCount !== 1 ? "s" : ""},{" "}
        {componentCount} component{componentCount !== 1 ? "s" : ""},{" "}
        {linkCount} link{linkCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

/**
 * Inline badge for a specific component showing its cross-page identity.
 */
export function ComponentCrossPageBadge({
  componentId,
}: {
  componentId: string;
}) {
  const { compositeAnalysis, pdfCurrentPage } = useCADStore();

  if (!compositeAnalysis) return null;

  const currentPageSource = `pdf:${pdfCurrentPage}`;

  // Find the canonical identity that contains this component on this page
  const identity = compositeAnalysis.components.find((comp) => {
    const pageComps = comp.pageAppearances[currentPageSource];
    return pageComps?.includes(componentId);
  });

  if (!identity) return null;

  // Count how many other pages this component appears on
  const otherPages = Object.keys(identity.pageAppearances).filter(
    (ps) => ps !== currentPageSource
  );

  if (otherPages.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#F0F7E3] border border-[#C5D99B] rounded text-[10px] text-[#5A7D00]">
      <Link2 className="w-3 h-3" />
      <span>{identity.canonicalName}</span>
      <span className="text-[#93C90F]/50">
        (+{otherPages.length} page{otherPages.length !== 1 ? "s" : ""})
      </span>
    </div>
  );
}
