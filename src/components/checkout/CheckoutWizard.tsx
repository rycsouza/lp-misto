"use client";

import React, { useState, useEffect } from "react";
import { GameSelect } from "./steps/GameSelect";
import { TicketType } from "./steps/TicketType";
import { BuyerInfo } from "./steps/BuyerInfo";
import { PaymentMethodStep } from "./steps/PaymentMethodStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createOrder, fetchUpsellOffer } from "@/app/actions/checkout";
import type { UpsellOfferDisplay } from "@/components/checkout/UpsellCard";
import type { CouponValidation } from "@/app/actions/coupon";

interface Game {
  id: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  round: string;
}

export interface ActiveTicketPromotion {
  name: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  minOrderCents: number;
}

interface CheckoutWizardProps {
  games: Game[];
  inteiraPriceCents: number;
  meiaPriceCents: number;
  initialGameId?: string | null;
  initialCouponCode?: string | null;
  ticketPromotion?: ActiveTicketPromotion | null;
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
  orderId?: string;
  confirmed?: boolean;
  upsellOffer?: UpsellOfferDisplay | null; // undefined = not yet fetched
  upsellAccepted: boolean;
  upsellGameId: string;
  coupon?: CouponValidation | null;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  selectedGameIds: [],
  gameTickets: {},
  buyer: { name: "", email: "", whatsapp: "" },
  upsellAccepted: false,
  upsellGameId: "",
};

export function CheckoutWizard({
  games,
  inteiraPriceCents,
  meiaPriceCents,
  initialGameId,
  initialCouponCode,
  ticketPromotion,
}: CheckoutWizardProps) {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  useEffect(() => {
    if (initialGameId && games.some((g) => g.id === initialGameId)) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setState({ ...DEFAULT_STATE, selectedGameIds: [initialGameId], step: 1 });
      return;
    }
    if (games.length === 1) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setState({ ...DEFAULT_STATE, selectedGameIds: [games[0].id], step: 1 });
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState;
        // Não restaura a partir do step de pagamento
        if (parsed.step >= 3) parsed.step = 2;
        // Sempre re-busca upsell do servidor — nunca usa cache local
        setState({ ...parsed, upsellOffer: undefined });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch upsell as soon as tickets are selected (step >= 1, totalCents > 0)
  // so the offer is ready by the time the user reaches the payment step
  useEffect(() => {
    if (state.step < 1 || totalCents === 0) return;
    if (state.upsellOffer !== undefined) return; // already fetched
    fetchUpsellOffer({ purchaseType: "ticket", totalCents }).then((offer) => {
      save({ upsellOffer: offer });
      if (offer) {
        save({ upsellGameId: games[0]?.id ?? "" });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);


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

  const totalCents = state.selectedGameIds.reduce((sum, gameId) => {
    const t = state.gameTickets[gameId] ?? { inteira: 0, meia: 0 };
    return sum + t.inteira * inteiraPriceCents + t.meia * meiaPriceCents;
  }, 0);

  const selectedGames = games.filter((g) => state.selectedGameIds.includes(g.id));

  const tickets = state.selectedGameIds.flatMap((gameId) => {
    const t = state.gameTickets[gameId] ?? { inteira: 0, meia: 0 };
    const items = [];
    if (t.inteira > 0)
      items.push({ gameId, type: "inteira" as const, quantity: t.inteira, unitPriceCents: inteiraPriceCents });
    if (t.meia > 0)
      items.push({ gameId, type: "meia" as const, quantity: t.meia, unitPriceCents: meiaPriceCents });
    return items;
  });

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
          ticketPromotion={ticketPromotion}
        />
      )}

      {state.step === 2 && (
        <BuyerInfo
          buyer={state.buyer}
          onChange={(b) => save({ buyer: b })}
          onNext={() => save({ step: 3 })}
          onBack={() => save({ step: 1 })}
        />
      )}

      {state.step === 3 && (
        <PaymentMethodStep
          totalCents={totalCents + (state.upsellAccepted && state.upsellOffer ? state.upsellOffer.discountedPriceCents : 0) - (state.coupon?.discountCents ?? 0)}
          upsellOffer={state.upsellOffer ?? null}
          upsellAccepted={state.upsellAccepted}
          upsellGameId={state.upsellGameId}
          games={games}
          onUpsellAccept={(gameId) => save({ upsellAccepted: true, upsellGameId: gameId })}
          onUpsellDecline={() => save({ upsellAccepted: false })}
          onUpsellGameChange={(gameId) => save({ upsellGameId: gameId })}
          coupon={state.coupon ?? null}
          customerWhatsapp={state.buyer.whatsapp}
          onCouponApply={(c) => save({ coupon: c })}
          onCouponRemove={() => save({ coupon: null })}
          initialCouponCode={initialCouponCode}
          onCreateOrder={(opts) =>
            createOrder({
              buyer: state.buyer,
              tickets,
              paymentMethod: opts.method,
              cardData:
                opts.method === "credit_card" && opts.cardToken
                  ? {
                      cardToken: opts.cardToken,
                      installments: opts.installments ?? 1,
                      paymentMethodId: opts.paymentMethodId ?? "",
                      identificationNumber: opts.identificationNumber ?? "",
                    }
                  : undefined,
              asaasCardData: opts.asaasCardData,
              customerCpf: opts.customerCpf,
              upsell:
                state.upsellAccepted && state.upsellOffer
                  ? {
                      offerId: state.upsellOffer.id,
                      offerType: state.upsellOffer.offerType,
                      gameId: state.upsellGameId || undefined,
                      unitPriceCents: Math.round(state.upsellOffer.discountedPriceCents / (state.upsellOffer.offerQuantity || 1)),
                      quantity: state.upsellOffer.offerQuantity || 1,
                    }
                  : null,
              couponCode: state.coupon?.code ?? null,
            })
          }
          onPaid={(orderId) => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 4, orderId, confirmed: true }));
          }}
          onFailed={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 4, confirmed: false }));
          }}
          onBack={() => save({ step: 2 })}
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
