"use client";

import { useState, useEffect } from "react";

export function DevBanner() {
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      setHost(window.location.host);
    }
  }, []);

  if (!host) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-[22px] text-center leading-[22px] pointer-events-none z-[99999] font-mono text-[11px] font-bold tracking-wider"
      style={{ background: "#D1F56A", color: "#47009e", opacity: 0.85 }}
    >
      DEV — {host}
    </div>
  );
}
