"use client";

import { useState } from "react";
import { exportOrdersCSV } from "@/app/actions/admin";
import { Download } from "lucide-react";

interface Props {
  status?: string;
  search?: string;
  productId?: string;
  type?: "ticket" | "product";
  from?: string;
  to?: string;
  excludeCourtesy?: boolean;
}

export function ExportOrdersButton({ status, search, productId, type, from, to, excludeCourtesy }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const csv = await exportOrdersCSV({ status, search, productId, type, from, to, excludeCourtesy });
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedidos${status && status !== "all" ? `-${status}` : ""}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 bg-secondary border border-border text-foreground rounded-lg px-3 py-2 text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
    >
      <Download size={14} />
      {loading ? "Exportando..." : "Exportar CSV"}
    </button>
  );
}
