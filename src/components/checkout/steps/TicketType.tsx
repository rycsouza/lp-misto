"use client";

import { Minus, Plus } from "lucide-react";

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
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function QtyControl({
  label,
  price,
  qty,
  onChange,
}: {
  label: string;
  price: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-primary">{formatPrice(price)}</p>
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
}: TicketTypeProps) {
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
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Tipo de Ingresso
      </h2>

      <div className="space-y-4 mb-6">
        {games.map((game) => {
          const t = gameTickets[game.id] ?? { inteira: 0, meia: 0 };
          const d = new Date(game.date);
          const gameTotal = t.inteira * inteiraPriceCents + t.meia * meiaPriceCents;

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
                  qty={t.inteira}
                  onChange={(n) => onChange(game.id, "inteira", n)}
                />
                <QtyControl
                  label="Meia-entrada"
                  price={meiaPriceCents}
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
