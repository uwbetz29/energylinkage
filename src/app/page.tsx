"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, Ruler, Download, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Ruler className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">EnergyLinkage</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/viewer")}
          >
            Open Viewer
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">
            Scale Power Generation Drawings
            <br />
            <span className="text-blue-500">In Seconds, Not Hours</span>
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Upload your CAD drawings, click on components, enter new dimensions,
            and export updated drawings. Built for EnergyLink business
            development teams to turn around proposals faster.
          </p>
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/viewer")}
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload a Drawing
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-8 mt-20">
          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
            <Upload className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="font-semibold mb-2">Upload DXF/DWG</h3>
            <p className="text-sm text-zinc-400">
              Load your existing CAD drawings directly in the browser. Supports
              DXF files with DWG conversion coming soon.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
            <Ruler className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="font-semibold mb-2">Click & Scale</h3>
            <p className="text-sm text-zinc-400">
              Click any component — stack, duct, silencer — and enter new
              dimensions or a scale percentage. Connected parts adjust
              automatically.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
            <Download className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="font-semibold mb-2">Export Instantly</h3>
            <p className="text-sm text-zinc-400">
              Download your modified drawings as DXF, DWG, or PDF. Every change
              is tracked with full version history.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
