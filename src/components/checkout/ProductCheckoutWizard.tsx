"use client";

import React, { useState, useEffect } from "react";
import { CartReview } from "./steps/CartReview";
import { BuyerInfo } from "./steps/BuyerInfo";
import { PaymentMethodStep } from "./steps/PaymentMethodStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createProductOrder } from "@/app/actions/checkout";
import { useCart } from "@/hooks/useCart";

const STEP_LABELS = ["Carrinho", "Dados", "Pagamento", "Conclusão"];
const STORAGE_KEY = "misto_product_checkout";

interface WizardState {
  step: number;
  buyer: { name: string; email: string; whatsapp: string };
  orderId?: string;
  confirmed?: boolean;
}

export function ProductCheckoutWizard({ initialStep = 0 }: { initialStep?: number }) {
  const defaultState: WizardState = { step: initialStep, buyer: { name: "", email: "", whatsapp: "" } };
  const [state, setState] = useState<WizardState>(defaultState);
  const { items, totalCents, clearCart } = useCart();

  useEffect(() => {
    if (initialStep > 0) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState;
        // Não restaura a partir do step de pagamento — recomeça
        if (parsed.step >= 2) parsed.step = 1;
        setState(parsed);
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
        <CartReview onNext={() => save({ step: 1 })} />
      )}

      {state.step === 1 && (
        <BuyerInfo
          buyer={state.buyer}
          onChange={(b) => save({ buyer: b })}
          onNext={() => save({ step: 2 })}
          onBack={() => save({ step: 0 })}
        />
      )}

      {state.step === 2 && (
        <PaymentMethodStep
          totalCents={totalCents}
          onCreateOrder={(opts) =>
            createProductOrder({
              buyer: state.buyer,
              items: items.map((i) => ({
                productId: i.productId,
                variantId: i.variantId,
                name: i.name,
                size: i.size,
                quantity: i.quantity,
                unitPriceCents: i.priceCents,
              })),
              pickupInfo: "A definir — aguardar contato via WhatsApp",
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
            })
          }
          onPaid={(orderId) => {
            sessionStorage.removeItem(STORAGE_KEY);
            clearCart();
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
          successMessage="Seu pedido foi confirmado! Enviaremos uma confirmação por e-mail e entraremos em contato pelo WhatsApp para combinar a retirada."
          onRetry={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState(defaultState);
          }}
        />
      )}
    </div>
  );
}
