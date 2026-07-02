"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { listBarPrepQueue, markBarTabReady, type BarTabView } from "@/app/actions/bar";

export function BarPrepPanel({ games }: { games: { id: string; label: string }[] }) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [queue, setQueue] = useState<BarTabView[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const rows = await listBarPrepQueue(gameId);
    setQueue(rows);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    // Estado de carregamento + fetch assíncrono ao trocar de jogo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  function markReady(orderId: string) {
    startTransition(async () => {
      const res = await markBarTabReady(orderId);
      if (res.success) setQueue((q) => q.filter((t) => t.orderId !== orderId));
      else await refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        {games.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
      </select>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando fila…</p>
      ) : queue.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhuma ficha em preparo. 🎉
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {queue.map((t) => (
            <div key={t.orderId} className="bg-card border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground truncate">{t.customerName}</span>
                <span className="text-[11px] text-muted-foreground font-mono">#{t.orderId.slice(0, 8)}</span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {t.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-foreground">
                      <span className="text-muted-foreground">{it.quantity}×</span> {it.name}
                    </span>
                    {it.needsPrep && <span className="text-[10px] text-amber-500 uppercase">preparo</span>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isPending}
                onClick={() => markReady(t.orderId)}
                className="bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                Marcar pronta
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
