"use client";

import { Minus, Plus, Zap, Ticket } from "lucide-react";
import type {
  ActiveTicketPromotion,
  CheckoutTicketType,
} from "@/components/checkout/CheckoutWizard";
import { computeCartCombo } from "@/lib/promotions/bundle";

interface Game {
  id: string;
  opponent: string;
  date: string;
  ticketTypes: CheckoutTicketType[];
}

type GameTickets = Record<string, number>;

interface TicketTypeProps {
  games: Game[];
  gameTickets: Record<string, GameTickets>;
  onChange: (gameId: string, code: string, qty: number) => void;
  onNext: () => void;
  onBack?: () => void;
  ticketPromotion?: ActiveTicketPromotion | null;
  highlightGameId?: string | null;
}

function gameSum(t: GameTickets): number {
  return Object.values(t).reduce((s, n) => s + (n || 0), 0);
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function applyPromoDiscount(
  priceCents: number,
  promo: ActiveTicketPromotion
): number {
  if (priceCents < promo.minOrderCents) return priceCents;
  if (promo.discountType === "pct") {
    const pct = Math.min(promo.discountValue, 100);
    return Math.max(0, priceCents - Math.round((priceCents * pct) / 100));
  }
  return Math.max(0, priceCents - Math.min(promo.discountValue, priceCents));
}

function QtyControl({
  label,
  price,
  salePrice,
  qty,
  onChange,
}: {
  label: string;
  price: number;
  salePrice?: number | null;
  qty: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {salePrice != null && salePrice < price ? (
          <div className="flex flex-col">
            <p className="text-[10px] text-muted-foreground line-through leading-tight">{formatPrice(price)}</p>
            <p className="text-xs text-primary font-semibold leading-tight">{formatPrice(salePrice)}</p>
          </div>
        ) : (
          <p className="text-xs text-primary">{formatPrice(price)}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, qty - 1))}
          disabled={qty === 0}
          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
          aria-label="Diminuir"
        >
          <Minus size={14} />
        </button>
        <span className="w-6 text-center font-bold">{qty}</span>
        <button
          onClick={() => onChange(Math.min(10, qty + 1))}
          disabled={qty === 10}
          className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
          aria-label="Aumentar"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export function TicketType({
  games,
  gameTickets,
  onChange,
  onNext,
  onBack,
  ticketPromotion,
  highlightGameId,
}: TicketTypeProps) {
  const totalCents = games.reduce((sum, game) => {
    const t = gameTickets[game.id] ?? {};
    return sum + game.ticketTypes.reduce((s, tt) => s + (t[tt.code] ?? 0) * tt.priceCents, 0);
  }, 0);

  const hasTickets = games.some((g) => gameSum(gameTickets[g.id] ?? {}) > 0);

  // Combo por tipo: cada tipo desconta conforme suas faixas
  const comboLines = games.flatMap((game) => {
    const t = gameTickets[game.id] ?? {};
    return game.ticketTypes.map((tt) => ({
      gameId: game.id,
      code: tt.code,
      qty: t[tt.code] ?? 0,
      priceCents: tt.priceCents,
      comboTiers: tt.comboTiers,
    }));
  });
  const bundle = computeCartCombo(comboLines);

  // Melhor oportunidade de combo ainda não atingida (estimula levar mais jogos)
  const comboNudge = (() => {
    const map = new Map<string, { name: string; tiers: { games: number; pct: number }[]; games: Set<string> }>();
    for (const g of games) {
      for (const tt of g.ticketTypes) {
        if (!tt.comboTiers?.length) continue;
        let e = map.get(tt.code);
        if (!e) {
          e = { name: tt.name, tiers: [...tt.comboTiers].sort((a, b) => a.games - b.games), games: new Set() };
          map.set(tt.code, e);
        }
        if ((gameTickets[g.id]?.[tt.code] ?? 0) > 0) e.games.add(g.id);
      }
    }
    let best: { name: string; neededGames: number; pct: number } | null = null;
    for (const e of map.values()) {
      const distinct = e.games.size;
      const next = e.tiers.find((t) => t.games > distinct);
      if (!next) continue;
      if (!best || next.pct > best.pct) best = { name: e.name, neededGames: next.games, pct: next.pct };
    }
    return best;
  })();

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-1">
        Escolha seus ingressos
      </h2>
      {games.length > 1 && (
        <p className="text-sm text-muted-foreground mb-4">
          Selecione a quantidade em cada jogo — você pode levar vários no mesmo pedido.
        </p>
      )}

      {comboNudge && (
        <div className="flex items-start gap-2 bg-primary/5 border border-dashed border-primary/40 rounded-lg px-3 py-2.5 mb-5">
          <Ticket size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <span className="font-semibold text-primary">Combo:</span> leve{" "}
            <b>{comboNudge.name}</b> em <b>{comboNudge.neededGames} jogos diferentes</b> e ganhe{" "}
            <span className="text-primary font-semibold">{comboNudge.pct}% de desconto</span>. É só
            adicionar ingressos de outro jogo abaixo. 🎟️
          </p>
        </div>
      )}

      {ticketPromotion && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mb-5">
          <Zap size={14} className="text-primary shrink-0" fill="currentColor" />
          <p className="text-sm text-foreground">
            <span className="text-primary font-semibold">Promoção ativa:</span>{" "}
            {ticketPromotion.name}{" "}
            <span className="text-muted-foreground text-xs">
              ({ticketPromotion.discountType === "pct"
                ? `${ticketPromotion.discountValue}% de desconto`
                : `R$${(ticketPromotion.discountValue / 100).toFixed(2).replace(".", ",")} de desconto`
              })
            </span>
          </p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {games.map((game) => {
          const t = gameTickets[game.id] ?? {};
          const d = new Date(game.date);
          const gameTotal = game.ticketTypes.reduce((s, tt) => {
            const eff = ticketPromotion ? applyPromoDiscount(tt.priceCents, ticketPromotion) : tt.priceCents;
            return s + (t[tt.code] ?? 0) * eff;
          }, 0);

          return (
            <div
              key={game.id}
              className={`bg-card border rounded-xl p-4 ${
                game.id === highlightGameId ? "border-primary/60" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-[family-name:var(--font-bebas-neue)] text-base text-foreground">
                    vs {game.opponent}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                </div>
                {gameTotal > 0 && (
                  <span className="text-xs text-primary font-semibold">{formatPrice(gameTotal)}</span>
                )}
              </div>
              {game.ticketTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhum tipo de ingresso configurado para este jogo.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {game.ticketTypes.map((tt) => {
                    const salePrice = ticketPromotion
                      ? applyPromoDiscount(tt.priceCents, ticketPromotion)
                      : null;
                    return (
                      <div key={tt.code}>
                        <QtyControl
                          label={tt.name}
                          price={tt.priceCents}
                          salePrice={salePrice}
                          qty={t[tt.code] ?? 0}
                          onChange={(n) => onChange(game.id, tt.code, n)}
                        />
                        {tt.description && (
                          <p className="text-[11px] text-muted-foreground -mt-1 pb-2 leading-snug">
                            {tt.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasTickets && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl mb-6">
          <p className="text-sm text-muted-foreground">Total</p>
          {bundle.totalCents > 0 ? (
            <>
              <p className="text-sm text-muted-foreground line-through leading-tight">
                {formatPrice(totalCents)}
              </p>
              <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary leading-tight">
                {formatPrice(totalCents - bundle.totalCents)}
              </p>
              <p className="text-xs text-primary mt-0.5">
                Desconto de combo aplicado: −{formatPrice(bundle.totalCents)}
              </p>
            </>
          ) : (
            <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">
              {formatPrice(totalCents)}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
          >
            Voltar
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!hasTickets}
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
