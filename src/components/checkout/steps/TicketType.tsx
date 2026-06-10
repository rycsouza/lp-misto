"use client";

import { Minus, Plus } from "lucide-react";

interface TicketTypeProps {
  inteiraPriceCents: number;
  meiaPriceCents: number;
  inteiraQty: number;
  meiaQty: number;
  onChangeInteira: (qty: number) => void;
  onChangeMeia: (qty: number) => void;
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
    <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
      <div>
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-primary font-bold">{formatPrice(price)}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, qty - 1))}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
          disabled={qty === 0}
          aria-label="Diminuir"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center font-bold text-xl">{qty}</span>
        <button
          onClick={() => onChange(Math.min(10, qty + 1))}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
          disabled={qty === 10}
          aria-label="Aumentar"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function TicketType({
  inteiraPriceCents,
  meiaPriceCents,
  inteiraQty,
  meiaQty,
  onChangeInteira,
  onChangeMeia,
  onNext,
  onBack,
}: TicketTypeProps) {
  const total = inteiraQty * inteiraPriceCents + meiaQty * meiaPriceCents;
  const hasTickets = inteiraQty + meiaQty > 0;

  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-6">
        Tipo de Ingresso
      </h2>

      <div className="space-y-3 mb-6">
        <QtyControl
          label="Inteira"
          price={inteiraPriceCents}
          qty={inteiraQty}
          onChange={onChangeInteira}
        />
        <QtyControl
          label="Meia-entrada"
          price={meiaPriceCents}
          qty={meiaQty}
          onChange={onChangeMeia}
        />
      </div>

      {hasTickets && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl mb-6">
          <p className="text-sm text-muted-foreground">Total parcial</p>
          <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">
            {formatPrice(total)}
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
