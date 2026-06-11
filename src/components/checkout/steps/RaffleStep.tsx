/*
 * RAFFLE STEP — REMOVIDO DO FLUXO EM 2026-06-11
 *
 * Era o step 3 (de 6) no CheckoutWizard original: "Sorte".
 *
 * Visual: seletor de quantidade (0–3) de "Números da Sorte".
 *   - Preço por número: `raffle.number_price_cents` em site_config (padrão R$ 5,00).
 *   - Botão mostrava "Pular" quando qty=0 e "Continuar" quando qty>0.
 *   - Era opcional; qty=0 avançava normalmente sem cobrar.
 *
 * Integração:
 *   - WizardState tinha `raffleQty: number`.
 *   - CheckoutWizardProps tinha `rafflePriceCents: number`.
 *   - createOrder recebia `raffles: { quantity, unitPriceCents }` e criava
 *     orderItems do type "raffle" (referenceId: null, metadata: null).
 *   - totalCents incluía raffleQty * rafflePriceCents.
 *
 * Para reativar:
 *   1. Adicionar step 2 em STEP_LABELS, importar e renderizar <RaffleStep> no wizard.
 *   2. Restaurar raffleQty no WizardState e rafflePriceCents nas props.
 *   3. Passar raffles para createOrder e restaurar o cálculo do total.
 *   4. Restaurar `raffleNumberPriceCents` em getSiteConfig/ingresso/page.tsx.
 */

"use client";

import { Minus, Plus } from "lucide-react";

interface RaffleStepProps {
  raffleQty: number;
  rafflePriceCents: number;
  onChange: (qty: number) => void;
  onNext: () => void;
  onBack: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

export function RaffleStep({
  raffleQty,
  rafflePriceCents,
  onChange,
  onNext,
  onBack,
}: RaffleStepProps) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground mb-2">
        Número da Sorte
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        Opcional. Adicione números para concorrer a sorteios exclusivos.{" "}
        <span className="text-primary font-semibold">{formatPrice(rafflePriceCents)} cada</span>
      </p>

      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl mb-6">
        <div>
          <p className="font-semibold text-foreground">Números da sorte</p>
          {raffleQty > 0 && (
            <p className="text-primary font-bold">
              {formatPrice(raffleQty * rafflePriceCents)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(0, raffleQty - 1))}
            disabled={raffleQty === 0}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
            aria-label="Diminuir"
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center font-bold text-xl">{raffleQty}</span>
          <button
            onClick={() => onChange(Math.min(3, raffleQty + 1))}
            disabled={raffleQty === 3}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-40"
            aria-label="Aumentar"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 transition-colors"
        >
          {raffleQty === 0 ? "Pular" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
