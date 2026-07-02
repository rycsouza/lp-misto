"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getBarFichaPublic, type BarFichaPublic } from "@/app/actions/bar";

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

interface StatusMeta {
  label: string;
  hint: string;
  tone: "wait" | "prep" | "ready" | "done" | "cancel";
}

function statusMeta(f: BarFichaPublic): StatusMeta {
  if (f.status === "refunded") return { label: "Reembolsada", hint: "Esta ficha foi reembolsada.", tone: "cancel" };
  if (f.status === "cancelled") return { label: "Cancelada", hint: "Esta ficha foi cancelada.", tone: "cancel" };
  if (f.status !== "paid") return { label: "Aguardando pagamento", hint: "Assim que o pagamento cair, a ficha entra em preparo.", tone: "wait" };
  if (f.fulfillmentStatus === "delivered") return { label: "Entregue", hint: "Pedido retirado. Bom jogo! ⚽", tone: "done" };
  if (f.fulfillmentStatus === "ready") return { label: "Pronto!", hint: "Mostre o QR no balcão para retirar.", tone: "ready" };
  return { label: "Em preparo", hint: "Estamos preparando seu pedido. Já te avisamos quando ficar pronto.", tone: "prep" };
}

const TONE: Record<StatusMeta["tone"], string> = {
  wait: "bg-muted text-muted-foreground",
  prep: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  ready: "bg-green-500/15 text-green-500 border border-green-500/40",
  done: "bg-secondary text-muted-foreground",
  cancel: "bg-destructive/10 text-destructive border border-destructive/30",
};

export function BarFichaView({ orderId, initial }: { orderId: string; initial?: BarFichaPublic }) {
  const [ficha, setFicha] = useState<BarFichaPublic | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);

  const refresh = useCallback(async () => {
    const data = await getBarFichaPublic(orderId);
    setFicha(data);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    // Fetch assíncrono de montagem quando não há estado inicial (setState pós-await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initial) refresh();
  }, [initial, refresh]);

  // Polling do status ao vivo — pausa quando a aba não está visível (economia).
  useEffect(() => {
    const isTerminal = ficha?.status === "paid" && ficha?.fulfillmentStatus === "delivered";
    if (isTerminal || ficha?.status === "refunded" || ficha?.status === "cancelled") return;
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [ficha?.status, ficha?.fulfillmentStatus, refresh]);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Carregando ficha…</p>;
  }
  if (!ficha || !ficha.found) {
    return <p className="text-sm text-muted-foreground text-center py-8">Ficha não encontrada.</p>;
  }

  const meta = statusMeta(ficha);
  const showQr = ficha.status === "paid" && ficha.fulfillmentStatus !== "delivered";

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sua ficha do bar</p>
        <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${TONE[meta.tone]}`}>
          {meta.label}
        </span>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">{meta.hint}</p>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={orderId} size={180} />
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">#{orderId.slice(0, 8)}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        {ficha.items?.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              <span className="text-muted-foreground">{it.quantity}×</span> {it.name}
              {it.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase">preparo</span>}
            </span>
            <span className="text-muted-foreground tabular-nums">{brl(it.quantity * it.unitPriceCents)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span className="tabular-nums">{brl(ficha.subtotalCents ?? 0)}</span>
        </div>
        {(ficha.serviceFeeCents ?? 0) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa de serviço</span><span className="tabular-nums">{brl(ficha.serviceFeeCents ?? 0)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-foreground pt-1">
          <span>Total</span><span className="tabular-nums">{brl(ficha.totalCents ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
