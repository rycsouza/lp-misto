"use client";

import { useState, useTransition } from "react";
import {
  KeyRound, CheckCircle2, XCircle, Clock, Package, User, Loader2,
} from "lucide-react";
import {
  lookupPickupByCode,
  confirmPickupDelivery,
  getPendingPickups,
  getRecentPickups,
  type PickupOrderSummary,
} from "@/app/actions/pickup";

function fmtBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtWhatsApp(raw: string): string {
  const d = (raw || "").replace(/\D/g, "").slice(-11);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

type Feedback = { kind: "success" | "error"; message: string } | null;

export function PickupValidation({
  initialPending,
  initialRecent,
}: {
  initialPending: PickupOrderSummary[];
  initialRecent: PickupOrderSummary[];
}) {
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<PickupOrderSummary | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(initialPending);
  const [recent, setRecent] = useState(initialRecent);
  const [isLooking, startLookup] = useTransition();
  const [isConfirming, startConfirm] = useTransition();

  async function refreshLists() {
    const [p, r] = await Promise.all([getPendingPickups(), getRecentPickups()]);
    setPending(p);
    setRecent(r);
  }

  function handleLookup(e?: React.FormEvent) {
    e?.preventDefault();
    setFeedback(null);
    setSelected(null);
    startLookup(async () => {
      const res = await lookupPickupByCode(code);
      if (res.ok) {
        setSelected(res.order);
      } else {
        setFeedback({ kind: "error", message: res.message });
      }
    });
  }

  function selectFromQueue(order: PickupOrderSummary) {
    setFeedback(null);
    setCode(order.code ?? "");
    setSelected(order);
  }

  function handleConfirm() {
    if (!selected) return;
    startConfirm(async () => {
      const res = await confirmPickupDelivery(selected.id);
      if (res.success) {
        setFeedback({
          kind: "success",
          message: `Retirada confirmada — ${selected.customerName}.`,
        });
        setSelected(null);
        setCode("");
        await refreshLists();
      } else {
        setFeedback({ kind: "error", message: res.error ?? "Falha ao confirmar." });
        if (res.alreadyDelivered) {
          setSelected(null);
          await refreshLists();
        }
      }
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Coluna esquerda: entrada de código + confirmação ─────────────── */}
      <div className="flex flex-col gap-4">
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            <h3 className="font-semibold text-foreground">Código do cliente</h3>
          </div>
          <form onSubmit={handleLookup} className="flex gap-2 items-stretch">
            <input
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className={`${inputClass} flex-1 font-mono text-2xl tracking-[0.4em] text-center`}
            />
            <button
              type="submit"
              disabled={isLooking || code.length !== 6}
              className="bg-primary text-primary-foreground rounded-lg px-5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2"
            >
              {isLooking ? <Loader2 size={16} className="animate-spin" /> : null}
              Buscar
            </button>
          </form>

          {feedback && (
            <div
              className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                feedback.kind === "success"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.kind === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {feedback.message}
            </div>
          )}

          {/* Cartão de conferência do pedido encontrado */}
          {selected && (
            <div className="border border-primary/40 rounded-xl p-4 flex flex-col gap-3 bg-primary/5">
              <div className="flex items-center gap-2">
                <User size={15} className="text-muted-foreground" />
                <span className="font-semibold text-foreground">{selected.customerName}</span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span>{fmtWhatsApp(selected.customerWhatsapp)}</span>
                <span>Pedido {selected.id.slice(0, 8).toUpperCase()}</span>
                <span>{fmtDate(selected.createdAt)}</span>
              </div>
              <ul className="flex flex-col gap-1 border-t border-border pt-3">
                {selected.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <Package size={13} className="text-muted-foreground shrink-0" />
                    <span className="flex-1">{it.label}</span>
                    <span className="text-muted-foreground">×{it.qty}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">{fmtBRL(selected.totalCents)}</span>
              </div>
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="bg-green-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isConfirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Confirmar retirada
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ── Coluna direita: fila + recentes ──────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Aguardando retirada</h3>
            <span className="text-xs text-muted-foreground">{pending.length} pedido(s)</span>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido na fila de retirada.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((o) => (
                <li key={o.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.items.map((i) => `${i.label} ×${i.qty}`).join(", ")}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-foreground tracking-widest shrink-0">{o.code}</span>
                  {o.fulfillmentStatus === "ready" && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Pronto
                    </span>
                  )}
                  <button
                    onClick={() => selectFromQueue(o)}
                    className="text-xs border border-border rounded-lg px-3 py-1.5 text-foreground hover:bg-secondary transition-colors shrink-0"
                  >
                    Validar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Retiradas recentes</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma retirada confirmada ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="py-2 flex items-center gap-3 text-sm">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-foreground">{o.customerName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {fmtDate(o.deliveredAt)}{o.deliveredBy ? ` · ${o.deliveredBy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
