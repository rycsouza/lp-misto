"use client";

import React, { useState, useEffect } from "react";
import { TicketType } from "./steps/TicketType";
import { BuyerInfo } from "./steps/BuyerInfo";
import { PaymentMethodStep } from "./steps/PaymentMethodStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createOrder, fetchUpsellOffer } from "@/app/actions/checkout";
import type { UpsellOfferDisplay } from "@/components/checkout/UpsellCard";
import type { CouponValidation } from "@/app/actions/coupon";
import { computeCartCombo, type BundleTier } from "@/lib/promotions/bundle";

export interface CheckoutTicketType {
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  comboTiers: BundleTier[];
}

interface Game {
  id: string;
  opponent: string;
  date: string;
  venue: string;
  competition: string;
  round: string;
  ticketTypes: CheckoutTicketType[];
}

export interface ActiveTicketPromotion {
  name: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  minOrderCents: number;
}

interface CheckoutWizardProps {
  games: Game[];
  initialGameId?: string | null;
  initialCouponCode?: string | null;
  ticketPromotion?: ActiveTicketPromotion | null;
  whatsapp?: string;
}

const STORAGE_KEY = "misto_checkout_state";
// Passo 0 unifica seleção de jogos + ingressos (tudo numa tela)
const STEP_LABELS = ["Ingressos", "Dados", "Pagamento", "Conclusão"];

// quantidade por código de tipo, ex: { inteira: 2, vip: 1 }
type GameTickets = Record<string, number>;

interface WizardState {
  step: number;
  gameTickets: Record<string, GameTickets>;
  buyer: { name: string; email: string; whatsapp: string };
  cpf?: string;
  orderId?: string;
  confirmed?: boolean;
  upsellOffer?: UpsellOfferDisplay | null; // undefined = not yet fetched
  upsellAccepted: boolean;
  upsellGameId: string;
  coupon?: CouponValidation | null;
}

const DEFAULT_STATE: WizardState = {
  step: 0,
  gameTickets: {},
  buyer: { name: "", email: "", whatsapp: "" },
  upsellAccepted: false,
  upsellGameId: "",
};

export function CheckoutWizard({
  games,
  initialGameId,
  initialCouponCode,
  ticketPromotion,
  whatsapp,
}: CheckoutWizardProps) {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  useEffect(() => {
    // Deep-link para um jogo específico → começa do zero (só destaca o jogo)
    if (initialGameId && games.some((g) => g.id === initialGameId)) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState;
        // Não restaura a partir do step de pagamento
        if (parsed.step >= 2) parsed.step = 0;
        // Sempre re-busca upsell do servidor — nunca usa cache local
        setState({ ...parsed, upsellOffer: undefined });
      }
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

  function changeTicket(gameId: string, code: string, qty: number) {
    save({
      gameTickets: {
        ...state.gameTickets,
        [gameId]: { ...(state.gameTickets[gameId] ?? {}), [code]: qty },
      },
    });
  }

  // Tudo derivado de gameTickets sobre TODOS os jogos disponíveis
  const totalCents = games.reduce((sum, g) => {
    const t = state.gameTickets[g.id] ?? {};
    return sum + g.ticketTypes.reduce((s, tt) => s + (t[tt.code] ?? 0) * tt.priceCents, 0);
  }, 0);

  // Desconto de combo (preview): por tipo, conforme as faixas de cada tipo
  const comboLines = games.flatMap((g) => {
    const t = state.gameTickets[g.id] ?? {};
    return g.ticketTypes.map((tt) => ({
      gameId: g.id,
      code: tt.code,
      qty: t[tt.code] ?? 0,
      priceCents: tt.priceCents,
      comboTiers: tt.comboTiers,
    }));
  });
  const bundle = computeCartCombo(comboLines);

  // Jogo do deep-link aparece primeiro (destacado)
  const orderedGames = initialGameId
    ? [...games].sort((a, b) => (a.id === initialGameId ? -1 : b.id === initialGameId ? 1 : 0))
    : games;

  const tickets = games.flatMap((g) => {
    const t = state.gameTickets[g.id] ?? {};
    return g.ticketTypes
      .filter((tt) => (t[tt.code] ?? 0) > 0)
      .map((tt) => ({
        gameId: g.id,
        typeCode: tt.code,
        typeName: tt.name,
        quantity: t[tt.code],
        unitPriceCents: tt.priceCents,
      }));
  });

  // Prefetch do upsell quando o carrinho passa a ter valor
  useEffect(() => {
    if (totalCents === 0 || state.upsellOffer !== undefined) return;
    fetchUpsellOffer({ purchaseType: "ticket", totalCents }).then((offer) => {
      save({ upsellOffer: offer });
      if (offer) save({ upsellGameId: games[0]?.id ?? "" });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents > 0]);

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
        <TicketType
          games={orderedGames}
          highlightGameId={initialGameId ?? null}
          gameTickets={state.gameTickets}
          onChange={changeTicket}
          onNext={() => save({ step: 1 })}
          ticketPromotion={ticketPromotion}
        />
      )}

      {state.step === 1 && (
        <BuyerInfo
          buyer={state.buyer}
          onChange={(b) => save({ buyer: b })}
          onCpfFound={(cpf) => save({ cpf })}
          onNext={() => save({ step: 2 })}
          onBack={() => save({ step: 0 })}
        />
      )}

      {state.step === 2 && (
        <PaymentMethodStep
          totalCents={totalCents - bundle.totalCents + (state.upsellAccepted && state.upsellOffer ? state.upsellOffer.discountedPriceCents : 0) - (state.coupon?.discountCents ?? 0)}
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
          initialCpf={state.cpf}
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
            setState((prev) => ({ ...prev, step: 3, orderId, confirmed: true }));
          }}
          onFailed={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 3, confirmed: false }));
          }}
          onBack={() => save({ step: 1 })}
        />
      )}

      {state.step === 3 && (
        <ConfirmationStep
          success={state.confirmed === true}
          orderId={state.orderId}
          whatsapp={whatsapp}
          onRetry={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState(DEFAULT_STATE);
          }}
        />
      )}
    </div>
  );
}
