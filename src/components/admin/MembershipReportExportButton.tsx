"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportMembershipReportCSV } from "@/app/actions/admin-membership-reports";

export function MembershipReportExportButton({ from, to }: { from: string; to: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const csv = await exportMembershipReportCSV({ from, to });
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socio-torcedor-${from}-a-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível exportar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-1.5 bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        <Download size={16} />
        {loading ? "Exportando..." : "Exportar CSV"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
