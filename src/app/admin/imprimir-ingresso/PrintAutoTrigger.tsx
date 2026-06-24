"use client";

import { useEffect } from "react";

export function PrintAutoTrigger() {
  useEffect(() => {
    // Wire up the print button
    const btn = document.getElementById("print-btn");
    if (btn) btn.onclick = () => window.print();

    // Auto-print after a short delay to allow images to load
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
