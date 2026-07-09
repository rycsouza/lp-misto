"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import {
  listCantinaPrepQueue,
  markCantinaRedemptionReady,
  deliverCantinaRedemption,
  type CantinaRedemptionView,
} from "@/app/actions/cantina";

export function CantinaPrepPanel() {
  const [queue, setQueue] = useState<CantinaRedemptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const rows = await listCantinaPrepQueue();
    setQueue(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  function markReady(id: string) {
    startTransition(async () => {
      const res = await markCantinaRedemptionReady(id);
      if (res.success) {
        setQueue((q) => q.map((r) => (r.redemptionId === id ? { ...r, status: "ready" } : r)));
      } else {
        await refresh();
      }
    });
  }

  function deliver(id: string) {
    startTransition(async () => {
      const res = await deliverCantinaRedemption(id);
      if (res.success) {
        setQueue((q) => q.filter((r) => r.redemptionId !== id));
      } else {
        await refresh();
      }
    });
  }

  const pending = queue.filter((r) => r.status === "pending");
  const ready = queue.filter((r) => r.status === "ready");

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Carregando fila…</p>;
  }
  if (queue.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
        Nenhuma retirada em preparo. 🎉
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">Em preparo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pending.map((r) => (
              <div key={r.redemptionId} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
                <span className="font-medium text-foreground">{r.customerName}</span>
                <ul className="flex flex-col gap-1 text-sm border-y border-border py-2">
                  {r.items.map((it, i) => (
                    <li key={i} className="text-foreground">
                      <span className="text-muted-foreground">{it.qty}×</span> {it.itemName}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => markReady(r.redemptionId)} disabled={isPending}
                  className="bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Marcar pronto
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {ready.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">Pronto p/ entrega</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ready.map((r) => (
              <div key={r.redemptionId} className="bg-card border border-green-500/40 rounded-2xl p-4 flex flex-col gap-2">
                <span className="font-medium text-foreground">{r.customerName}</span>
                <ul className="flex flex-col gap-1 text-sm border-y border-border py-2">
                  {r.items.map((it, i) => (
                    <li key={i} className="text-foreground">
                      <span className="text-muted-foreground">{it.qty}×</span> {it.itemName}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => deliver(r.redemptionId)} disabled={isPending}
                  className="bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Entregar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
