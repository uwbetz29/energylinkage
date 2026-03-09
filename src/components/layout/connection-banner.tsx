"use client";

import { Wifi, WifiOff } from "lucide-react";

interface ConnectionBannerProps {
  isConnected: boolean;
}

export function ConnectionBanner({ isConnected }: ConnectionBannerProps) {
  if (isConnected) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 shadow-lg text-sm text-amber-700">
      <WifiOff className="w-4 h-4" />
      <span>Reconnecting...</span>
    </div>
  );
}

export function ConnectionDot({ isConnected }: ConnectionBannerProps) {
  return (
    <div
      className="flex items-center gap-1.5 text-[10px] text-[#888]"
      title={isConnected ? "Connected" : "Disconnected"}
    >
      {isConnected ? (
        <Wifi className="w-3 h-3 text-[#93C90F]" />
      ) : (
        <WifiOff className="w-3 h-3 text-amber-500" />
      )}
    </div>
  );
}
