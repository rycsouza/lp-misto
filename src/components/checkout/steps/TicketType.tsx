"use client";

import { Minus, Plus, Zap } from "lucide-react";
import type { ActiveTicketPromotion } from "@/components/checkout/CheckoutWizard";

interface Game {
  id: string;
  opponent: string;
  date: string;
}

interface GameTickets {
  inteira: number;
  meia: number;
}

interface TicketTypeProps {
  games: Game[];
  inteiraPriceCents: number;
  meiaPriceCents: number;
  gameTickets: Record<string, GameTickets>;
  onChange: (gameId: string, type: "inteira" | "meia", qty: number) => void;
  onNext: () => void;
  onBack: () => void;
  ticketPromotion?: ActiveTicketPromotion | null;
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
  inteiraPriceCents,
  meiaPriceCents,
  gameTickets,
  onChange,
  onNext,
  onBack,
  ticketPromotion,
}: TicketTypeProps) {
  const inteiraSalePrice = ticketPromotion ? applyPromoDiscount(inteiraPriceCents, ticketPromotion) : null;
  const meiaSalePrice = ticketPromotion ? applyPromoDiscount(meiaPriceCents, ticketPromotion) : null;
  const totalCents = games.reduce((sum, game) => {
    const t = gameTickets[game.id] ?? { inteira: 0, meia: 0 };
    return sum + t.inteira * inteiraPriceCents + t.meia * meiaPriceCents;
  }, 0);

  const hasTickets = games.some((g) => {
    const t = gameTickets[g.id] ?? { inteira: 0, meia: 0 };
    return t.inteira + t.meia > 0;
  });

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-4">
        Tipo de Ingresso
      </h2>

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
          const t = gameTickets[game.id] ?? { inteira: 0, meia: 0 };
          const d = new Date(game.date);
          const effectiveInteira = inteiraSalePrice ?? inteiraPriceCents;
          const effectiveMeia = meiaSalePrice ?? meiaPriceCents;
          const gameTotal = t.inteira * effectiveInteira + t.meia * effectiveMeia;

          return (
            <div key={game.id} className="bg-card border border-border rounded-xl p-4">
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
                    })}
                  </p>
                </div>
                {gameTotal > 0 && (
                  <span className="text-xs text-primary font-semibold">{formatPrice(gameTotal)}</span>
                )}
              </div>
              <div className="divide-y divide-border">
                <QtyControl
                  label="Inteira"
                  price={inteiraPriceCents}
                  salePrice={inteiraSalePrice}
                  qty={t.inteira}
                  onChange={(n) => onChange(game.id, "inteira", n)}
                />
                <QtyControl
                  label="Meia-entrada"
                  price={meiaPriceCents}
                  salePrice={meiaSalePrice}
                  qty={t.meia}
                  onChange={(n) => onChange(game.id, "meia", n)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasTickets && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl mb-6">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">
            {formatPrice(totalCents)}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
        >
          Voltar
        </button>
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
