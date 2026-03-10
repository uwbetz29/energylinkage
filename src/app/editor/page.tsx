import { Suspense } from "react";
import { EditorShell } from "@/components/editor/editor-shell";

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[#001030] text-white/30 text-sm">
          Loading editor...
        </div>
      }
    >
      <EditorShell />
    </Suspense>
  );
}
