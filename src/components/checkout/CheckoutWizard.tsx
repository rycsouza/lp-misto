"use client";

import { useState, useEffect } from "react";
import { GameSelect } from "./steps/GameSelect";
import { TicketType } from "./steps/TicketType";
import { RaffleStep } from "./steps/RaffleStep";
import { BuyerInfo } from "./steps/BuyerInfo";
import { PaymentStep } from "./steps/PaymentStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createOrder } from "@/app/actions/checkout";

interface Game {
  id: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  round: string;
}

interface CheckoutWizardProps {
  games: Game[];
  inteiraPriceCents: number;
  meiaPriceCents: number;
  rafflePriceCents: number;
  initialGameId?: string | null;
}

const STORAGE_KEY = "misto_checkout_state";
const STEP_LABELS = ["Jogo", "Ingresso", "Sorte", "Dados", "Pagamento", "Conclusão"];

interface WizardState {
  step: number;
  selectedGameId: string | null;
  inteiraQty: number;
  meiaQty: number;
  raffleQty: number;
  buyer: { name: string; email: string; whatsapp: string };
  paymentId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  orderId?: string;
  confirmed?: boolean;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  selectedGameId: null,
  inteiraQty: 0,
  meiaQty: 0,
  raffleQty: 0,
  buyer: { name: "", email: "", whatsapp: "" },
};

export function CheckoutWizard({
  games,
  inteiraPriceCents,
  meiaPriceCents,
  rafflePriceCents,
  initialGameId,
}: CheckoutWizardProps) {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGameId && games.some((g) => g.id === initialGameId)) {
      // Pre-selected game: clear any stale session and jump to ticket type step
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setState({ ...DEFAULT_STATE, selectedGameId: initialGameId, step: 1 });
      return;
    }
    // No pre-selection: restore previous session if available
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — initialGameId/games are stable server props

  function save(updates: Partial<WizardState>) {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function goTo(step: number) {
    save({ step });
  }

  async function handleSubmitOrder() {
    if (!state.selectedGameId) return;
    setLoading(true);
    setError(null);

    const result = await createOrder({
      buyer: state.buyer,
      tickets: [
        ...(state.inteiraQty > 0
          ? [
              {
                gameId: state.selectedGameId,
                type: "inteira" as const,
                quantity: state.inteiraQty,
                unitPriceCents: inteiraPriceCents,
              },
            ]
          : []),
        ...(state.meiaQty > 0
          ? [
              {
                gameId: state.selectedGameId,
                type: "meia" as const,
                quantity: state.meiaQty,
                unitPriceCents: meiaPriceCents,
              },
            ]
          : []),
      ],
      raffles:
        state.raffleQty > 0
          ? { quantity: state.raffleQty, unitPriceCents: rafflePriceCents }
          : null,
    });

    setLoading(false);

    if (!result.success || !result.pixQrCode) {
      setError(result.error ?? "Erro ao gerar pagamento");
      return;
    }

    save({
      step: 4,
      paymentId: result.paymentId,
      pixQrCode: result.pixQrCode,
      pixQrCodeUrl: result.pixQrCodeUrl,
      orderId: result.orderId,
    });
  }

  const totalCents =
    state.inteiraQty * inteiraPriceCents +
    state.meiaQty * meiaPriceCents +
    state.raffleQty * rafflePriceCents;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i === state.step
                  ? "bg-primary text-primary-foreground"
                  : i < state.step
                  ? "bg-primary/40 text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                i === state.step ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-6 h-px bg-border" />
            )}
          </div>
        ))}
      </div>

      {state.step === 0 && (
        <GameSelect
          games={games}
          selectedGameId={state.selectedGameId}
          onSelect={(id) => save({ selectedGameId: id })}
          onNext={() => goTo(1)}
        />
      )}

      {state.step === 1 && (
        <TicketType
          inteiraPriceCents={inteiraPriceCents}
          meiaPriceCents={meiaPriceCents}
          inteiraQty={state.inteiraQty}
          meiaQty={state.meiaQty}
          onChangeInteira={(n) => save({ inteiraQty: n })}
          onChangeMeia={(n) => save({ meiaQty: n })}
          onNext={() => goTo(2)}
          onBack={() => goTo(0)}
        />
      )}

      {state.step === 2 && (
        <RaffleStep
          raffleQty={state.raffleQty}
          rafflePriceCents={rafflePriceCents}
          onChange={(n) => save({ raffleQty: n })}
          onNext={() => goTo(3)}
          onBack={() => goTo(1)}
        />
      )}

      {state.step === 3 && (
        <>
          <BuyerInfo
            buyer={state.buyer}
            onChange={(b) => save({ buyer: b })}
            onNext={handleSubmitOrder}
            onBack={() => goTo(2)}
          />
          {loading && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Gerando cobrança PIX...
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}
        </>
      )}

      {state.step === 4 && state.pixQrCode && state.paymentId && (
        <PaymentStep
          pixQrCode={state.pixQrCode}
          pixQrCodeUrl={state.pixQrCodeUrl}
          paymentId={state.paymentId}
          totalCents={totalCents}
          onPaid={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            save({ step: 5, confirmed: true });
          }}
          onFailed={() => save({ step: 5, confirmed: false })}
        />
      )}

      {state.step === 5 && (
        <ConfirmationStep
          success={state.confirmed === true}
          orderId={state.orderId}
          onRetry={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState(DEFAULT_STATE);
          }}
        />
      )}
    </div>
  );
}
