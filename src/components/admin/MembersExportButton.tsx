"use client";

import { exportMembersCSV } from "@/app/actions/admin-growth";
import { useState } from "react";
import { Download } from "lucide-react";

interface MembersExportButtonProps {
  status?: string;
}

export function MembersExportButton({ status }: MembersExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const csv = await exportMembersCSV(status);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socios${status && status !== "all" ? `-${status}` : ""}.csv`;
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
      className="flex items-center gap-1.5 bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
    >
      <Download size={16} />
      {loading ? "Exportando..." : "Exportar CSV"}
    </button>
  );
}
