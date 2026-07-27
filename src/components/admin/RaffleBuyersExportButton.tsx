"use client";

import { exportRaffleBuyersCSV } from "@/app/actions/admin-raffles";
import { useState } from "react";
import { Download } from "lucide-react";

/** Baixa o CSV completo de compradores de um sorteio (uma linha por cliente). */
export function RaffleBuyersExportButton({ raffleId }: { raffleId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const csv = await exportRaffleBuyersCSV(raffleId);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compradores-sorteio.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
    >
      <Download size={14} />
      {loading ? "Exportando..." : "Exportar CSV"}
    </button>
  );
}
