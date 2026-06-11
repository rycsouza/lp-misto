"use client";

import React, { useState, useEffect } from "react";
import { GameSelect } from "./steps/GameSelect";
import { TicketType } from "./steps/TicketType";
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
  initialGameId?: string | null;
}

const STORAGE_KEY = "misto_checkout_state";
const STEP_LABELS = ["Jogos", "Ingressos", "Dados", "Pagamento", "Conclusão"];

interface GameTickets {
  inteira: number;
  meia: number;
}

interface WizardState {
  step: number;
  selectedGameIds: string[];
  gameTickets: Record<string, GameTickets>;
  buyer: { name: string; email: string; whatsapp: string };
  paymentId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  orderId?: string;
  confirmed?: boolean;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  selectedGameIds: [],
  gameTickets: {},
  buyer: { name: "", email: "", whatsapp: "" },
};

export function CheckoutWizard({
  games,
  inteiraPriceCents,
  meiaPriceCents,
  initialGameId,
}: CheckoutWizardProps) {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-selected game from URL param
    if (initialGameId && games.some((g) => g.id === initialGameId)) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setState({ ...DEFAULT_STATE, selectedGameIds: [initialGameId], step: 1 });
      return;
    }
    // Only one game available — auto-select and skip step 0
    if (games.length === 1) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setState({ ...DEFAULT_STATE, selectedGameIds: [games[0].id], step: 1 });
      return;
    }
    // Restore previous session
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(updates: Partial<WizardState>) {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleGame(gameId: string) {
    const ids = state.selectedGameIds.includes(gameId)
      ? state.selectedGameIds.filter((id) => id !== gameId)
      : [...state.selectedGameIds, gameId];
    // Remove tickets for deselected games
    const tickets = { ...state.gameTickets };
    if (!ids.includes(gameId)) delete tickets[gameId];
    save({ selectedGameIds: ids, gameTickets: tickets });
  }

  function changeTicket(gameId: string, type: "inteira" | "meia", qty: number) {
    save({
      gameTickets: {
        ...state.gameTickets,
        [gameId]: { ...(state.gameTickets[gameId] ?? { inteira: 0, meia: 0 }), [type]: qty },
      },
    });
  }

  async function handleSubmitOrder() {
    setLoading(true);
    setError(null);

    const tickets = state.selectedGameIds.flatMap((gameId) => {
      const t = state.gameTickets[gameId] ?? { inteira: 0, meia: 0 };
      const items = [];
      if (t.inteira > 0)
        items.push({ gameId, type: "inteira" as const, quantity: t.inteira, unitPriceCents: inteiraPriceCents });
      if (t.meia > 0)
        items.push({ gameId, type: "meia" as const, quantity: t.meia, unitPriceCents: meiaPriceCents });
      return items;
    });

    const result = await createOrder({ buyer: state.buyer, tickets });

    setLoading(false);

    if (!result.success || !result.pixQrCode) {
      setError(result.error ?? "Erro ao gerar pagamento");
      return;
    }

    save({ step: 3, paymentId: result.paymentId, pixQrCode: result.pixQrCode, pixQrCodeUrl: result.pixQrCodeUrl, orderId: result.orderId });
  }

  const totalCents = state.selectedGameIds.reduce((sum, gameId) => {
    const t = state.gameTickets[gameId] ?? { inteira: 0, meia: 0 };
    return sum + t.inteira * inteiraPriceCents + t.meia * meiaPriceCents;
  }, 0);

  const selectedGames = games.filter((g) => state.selectedGameIds.includes(g.id));

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress steps */}
      <div className="flex items-start mb-8">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
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
                className={`text-[10px] whitespace-nowrap ${
                  i === state.step ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mt-3.5 min-w-2 ${i < state.step ? "bg-primary/40" : "bg-border"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {state.step === 0 && (
        <GameSelect
          games={games}
          selectedGameIds={state.selectedGameIds}
          onToggle={toggleGame}
          onNext={() => save({ step: 1 })}
        />
      )}

      {state.step === 1 && (
        <TicketType
          games={selectedGames}
          inteiraPriceCents={inteiraPriceCents}
          meiaPriceCents={meiaPriceCents}
          gameTickets={state.gameTickets}
          onChange={changeTicket}
          onNext={() => save({ step: 2 })}
          onBack={() => save({ step: 0 })}
        />
      )}

      {state.step === 2 && (
        <>
          <BuyerInfo
            buyer={state.buyer}
            onChange={(b) => save({ buyer: b })}
            onNext={handleSubmitOrder}
            onBack={() => save({ step: 1 })}
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

      {state.step === 3 && state.pixQrCode && state.paymentId && (
        <PaymentStep
          pixQrCode={state.pixQrCode}
          pixQrCodeUrl={state.pixQrCodeUrl}
          paymentId={state.paymentId}
          totalCents={totalCents}
          onPaid={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 4, confirmed: true }));
          }}
          onFailed={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 4, confirmed: false }));
          }}
        />
      )}

      {state.step === 4 && (
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
