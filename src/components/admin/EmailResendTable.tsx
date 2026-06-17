"use client";

import { useState, useTransition } from "react";
import { resendOrderEmail } from "@/app/actions/admin";
import type { PaidOrderEmailRow } from "@/app/actions/admin";
import { Mail, Loader2, CheckCircle2, XCircle, Send } from "lucide-react";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

type RowStatus = "idle" | "sending" | "ok" | "error";

interface Props {
  rows: PaidOrderEmailRow[];
  total: number;
  page: number;
  totalPages: number;
  buildUrl: (overrides: Record<string, string | number>) => string;
}

export function EmailResendTable({ rows, total, page, totalPages, buildUrl }: Props) {
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkPending, startBulk] = useTransition();
  const [bulkDone, setBulkDone] = useState<{ sent: number; failed: number } | null>(null);

  function setStatus(id: string, s: RowStatus, err?: string) {
    setStatuses((p) => ({ ...p, [id]: s }));
    if (err) setErrors((p) => ({ ...p, [id]: err }));
  }

  async function handleResend(id: string) {
    setStatus(id, "sending");
    const result = await resendOrderEmail(id);
    setStatus(id, result.success ? "ok" : "error", result.error);
  }

  function handleBulk() {
    startBulk(async () => {
      setBulkDone(null);
      const pending = rows.filter((r) => (statuses[r.id] ?? "idle") === "idle");
      let sent = 0;
      let failed = 0;
      for (const row of pending) {
        setStatus(row.id, "sending");
        const result = await resendOrderEmail(row.id);
        if (result.success) { sent++; setStatus(row.id, "ok"); }
        else { failed++; setStatus(row.id, "error", result.error); }
      }
      setBulkDone({ sent, failed });
    });
  }

  const pendingCount = rows.filter((r) => (statuses[r.id] ?? "idle") === "idle").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk action */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {total} pedido{total !== 1 ? "s" : ""} pagos no total · página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-3">
          {bulkDone && (
            <span className="text-sm text-muted-foreground">
              {bulkDone.sent} enviado{bulkDone.sent !== 1 ? "s" : ""}
              {bulkDone.failed > 0 && ` · ${bulkDone.failed} com erro`}
            </span>
          )}
          <button
            onClick={handleBulk}
            disabled={bulkPending || pendingCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {bulkPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Reenviar desta página ({pendingCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Cliente</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden sm:table-cell">Data</th>
              <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium hidden sm:table-cell">Total</th>
              <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const status = statuses[row.id] ?? "idle";
              const typeLabel = row.hasProducts && row.hasTickets
                ? "Misto"
                : row.hasProducts ? "Produto" : "Ingresso";

              return (
                <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[180px]">{row.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.customerEmail}</p>
                    {errors[row.id] && (
                      <p className="text-xs text-destructive mt-0.5">{errors[row.id]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium hidden sm:table-cell whitespace-nowrap">
                    {formatPrice(row.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status === "idle" && (
                      <button
                        onClick={() => handleResend(row.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground rounded-md transition-colors"
                      >
                        <Mail size={12} />
                        Reenviar
                      </button>
                    )}
                    {status === "sending" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" />
                        Enviando…
                      </span>
                    )}
                    {status === "ok" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-green-500">
                        <CheckCircle2 size={12} />
                        Enviado
                      </span>
                    )}
                    {status === "error" && (
                      <button
                        onClick={() => handleResend(row.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-destructive hover:underline"
                      >
                        <XCircle size={12} />
                        Tentar de novo
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a href={buildUrl({ page: page - 1 })} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-secondary transition-colors">
              ← Anterior
            </a>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={buildUrl({ page: page + 1 })} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-secondary transition-colors">
              Próxima →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
