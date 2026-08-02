"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Check, AlertCircle } from "lucide-react";
import { reconcileCancelledOrders } from "@/app/actions/admin";

/**
 * Reconfere no gateway os pedidos CANCELADOS visíveis na página atual e corrige
 * os que na verdade foram pagos. Escopo = os IDs desta página (poucos itens), e
 * o servidor ainda aplica rate-limit + concorrência limitada no gateway.
 * Some quando não há cancelados na página (nada a conferir).
 */
export function ReconcileCancelledButton({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  if (orderIds.length === 0) return null;

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await reconcileCancelledOrders(orderIds);
      if (!res.ok) {
        setMsg({ tone: "warn", text: res.error ?? "Não foi possível conferir agora." });
        return;
      }
      if (res.corrected > 0) {
        setMsg({ tone: "ok", text: `${res.corrected} pedido${res.corrected > 1 ? "s" : ""} atualizado${res.corrected > 1 ? "s" : ""}.` });
        router.refresh();
      } else {
        setMsg({ tone: "ok", text: "Nenhuma correção — todos conferem." });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span
          className={`flex items-center gap-1 text-xs ${msg.tone === "ok" ? "text-green-500" : "text-amber-500"}`}
        >
          {msg.tone === "ok" ? <Check size={13} /> : <AlertCircle size={13} />}
          {msg.text}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={`Reconsultar no gateway ${orderIds.length} pedido(s) cancelado(s) desta página`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
      >
        <RotateCw size={14} className={isPending ? "animate-spin" : ""} />
        {isPending ? "Conferindo..." : "Conferir cancelados"}
      </button>
    </div>
  );
}
