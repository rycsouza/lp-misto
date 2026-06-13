"use client";

import { useState, useEffect } from "react";
import { Tag, Zap, X } from "lucide-react";

interface Game {
  id: string;
  opponent: string;
  date: string;
}

export interface UpsellOfferDisplay {
  id: string;
  name: string;
  description?: string | null;
  offerType: "ticket" | "product";
  offerTicketType?: "inteira" | "meia" | null;
  offerQuantity: number;
  originalPriceCents: number;
  discountPct: number;
  discountedPriceCents: number;
  timerSeconds: number;
}

interface UpsellCardProps {
  offer: UpsellOfferDisplay;
  games: Game[];
  accepted: boolean;
  selectedGameId: string;
  onAccept: (gameId: string) => void;
  onDecline: () => void;
  onGameChange: (gameId: string) => void;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function UpsellCard({ offer, games, accepted, selectedGameId, onAccept, onDecline, onGameChange }: UpsellCardProps) {
  const [timeLeft, setTimeLeft] = useState(offer.timerSeconds);

  useEffect(() => {
    if (timeLeft <= 0) { onDecline(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const needsGameSelect = offer.offerType === "ticket" && games.length > 1;
  const urgency = timeLeft < 60;

  return (
    <div className={`rounded-xl border overflow-hidden mb-4 transition-all duration-200 ${
      accepted ? "border-primary/60 bg-primary/5" : "border-amber-500/40 bg-amber-500/5"
    }`}>
      {/* Header with timer */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${
        accepted ? "bg-primary/10 border-primary/20" : "bg-amber-500/10 border-amber-500/20"
      }`}>
        <Zap size={13} className={`fill-current ${accepted ? "text-primary" : "text-amber-500"}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${accepted ? "text-primary" : "text-amber-500"}`}>
          Oferta Especial
        </span>
        <span className={`ml-auto text-xs font-mono font-semibold tabular-nums ${
          urgency ? "text-destructive animate-pulse" : accepted ? "text-primary" : "text-amber-500"
        }`}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-[family-name:var(--font-bebas-neue)] text-lg text-foreground leading-tight">
              {offer.name}
            </p>
            {offer.description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{offer.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground line-through">{formatPrice(offer.originalPriceCents * (offer.offerQuantity || 1))}</p>
            <p className="text-primary font-bold text-xl leading-tight">{formatPrice(offer.discountedPriceCents)}</p>
            <span className="inline-block bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5">
              -{offer.discountPct}% OFF
            </span>
          </div>
        </div>

        {/* Game selector — visible when accepted + ticket offer + multiple games */}
        {accepted && needsGameSelect && (
          <div className="mt-3">
            <label className="block text-xs text-muted-foreground mb-1">Jogo para este ingresso</label>
            <select
              value={selectedGameId}
              onChange={(e) => onGameChange(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  vs {g.opponent} —{" "}
                  {new Date(g.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          {!accepted ? (
            <>
              <button
                onClick={() => onAccept(needsGameSelect ? (selectedGameId || games[0]?.id || "") : (games[0]?.id || ""))}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 text-sm font-semibold transition-all"
              >
                <Tag size={13} />
                Adicionar à compra — economize {formatPrice(offer.originalPriceCents - offer.discountedPriceCents)}
              </button>
              <button
                onClick={onDecline}
                aria-label="Recusar oferta"
                className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 flex items-center gap-2 py-2 px-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary font-semibold">
                <span>✓</span>
                <span>Adicionado ao pedido</span>
              </div>
              <button
                onClick={onDecline}
                className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Remover
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
