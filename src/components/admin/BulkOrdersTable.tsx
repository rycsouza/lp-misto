"use client";

import { useState, useTransition } from "react";
import { bulkCancelOrders } from "@/app/actions/admin";
import { StatusBadge } from "./StatusBadge";
import Link from "next/link";
import { XCircle } from "lucide-react";

interface OrderRow {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  totalCents: number;
  gatewaySlug: string | null;
  displayStatus: string;
  createdAt: Date;
}

interface Props {
  rows: OrderRow[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function toWaLink(raw: string) {
  const d = raw.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}

export function BulkOrdersTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const cancellable = rows.filter(
    (r) => r.displayStatus === "pending" || r.displayStatus === "expired"
  );
  const allCancellableIds = new Set(cancellable.map((r) => r.id));
  const selectedCancellable = [...selected].filter((id) => allCancellableIds.has(id));

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkCancel() {
    if (selectedCancellable.length === 0) return;
    startTransition(async () => {
      const result = await bulkCancelOrders(selectedCancellable);
      setSelected(new Set());
      setFeedback(
        result.cancelled > 0
          ? `${result.cancelled} pedido${result.cancelled !== 1 ? "s" : ""} cancelado${result.cancelled !== 1 ? "s" : ""}.`
          : "Nenhum pedido pendente selecionado."
      );
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <>
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-foreground font-medium">
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          {selectedCancellable.length > 0 && (
            <button
              onClick={handleBulkCancel}
              disabled={isPending}
              className="flex items-center gap-1.5 bg-red-500/15 text-red-600 border border-red-500/20 rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              <XCircle size={14} />
              Cancelar {selectedCancellable.length} pedido{selectedCancellable.length !== 1 ? "s" : ""}
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Desmarcar
          </button>
        </div>
      )}

      {feedback && (
        <p className="text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
          {feedback}
        </p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* ── Mobile cards ─────────────────────────────────── */}
        <div className="md:hidden divide-y divide-border/50">
          {rows.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">
              Nenhum pedido encontrado
            </p>
          )}
          {rows.map((order) => (
            <div
              key={order.id}
              className={`px-4 py-3 flex flex-col gap-1.5 transition-colors ${
                selected.has(order.id) ? "bg-primary/5" : ""
              }`}
            >
              {/* Row 1: checkbox + name + status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggle(order.id)}
                    className="rounded border-border w-4 h-4 cursor-pointer accent-primary shrink-0 mt-0.5"
                  />
                  <span className="text-foreground font-medium text-sm truncate">
                    {order.customerName}
                  </span>
                </div>
                <StatusBadge status={order.displayStatus} />
              </div>
              {/* Row 2: whatsapp + total */}
              <div className="flex items-center justify-between pl-6">
                <a
                  href={toWaLink(order.customerWhatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground text-xs hover:text-green-500 transition-colors"
                >
                  {order.customerWhatsapp}
                </a>
                <span className="font-semibold text-foreground text-sm">
                  {formatCurrency(order.totalCents)}
                </span>
              </div>
              {/* Row 3: gateway + date + link */}
              <div className="flex items-center justify-between pl-6">
                <span className="text-muted-foreground text-xs">
                  {order.gatewaySlug?.toUpperCase() ?? "—"} · {formatDate(order.createdAt)}
                </span>
                <Link
                  href={`/admin/pedidos/${order.id}`}
                  className="text-primary text-xs hover:underline"
                >
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop table ─────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    className="rounded border-border w-4 h-4 cursor-pointer accent-primary"
                  />
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">ID</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Nome</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">WhatsApp</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Total</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Método</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Data</th>
                <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className={`border-b border-border/50 transition-colors ${selected.has(order.id) ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggle(order.id)}
                      className="rounded border-border w-4 h-4 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {order.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{order.customerName}</td>
                  <td className="px-4 py-3">
                    <a
                      href={toWaLink(order.customerWhatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-green-500 transition-colors"
                    >
                      {order.customerWhatsapp}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatCurrency(order.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground uppercase text-xs">
                    {order.gatewaySlug ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.displayStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pedidos/${order.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </>
  );
}
