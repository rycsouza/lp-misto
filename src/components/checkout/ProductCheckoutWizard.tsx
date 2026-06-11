"use client";

import React, { useState, useEffect } from "react";
import { CartReview } from "./steps/CartReview";
import { BuyerInfo } from "./steps/BuyerInfo";
import { PaymentStep } from "./steps/PaymentStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createProductOrder } from "@/app/actions/checkout";
import { useCart } from "@/hooks/useCart";

const STEP_LABELS = ["Carrinho", "Dados", "Pagamento", "Conclusão"];
const STORAGE_KEY = "misto_product_checkout";

interface WizardState {
  step: number;
  buyer: { name: string; email: string; whatsapp: string };
  paymentId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  orderId?: string;
  confirmed?: boolean;
}

export function ProductCheckoutWizard({ initialStep = 0 }: { initialStep?: number }) {
  const defaultState: WizardState = { step: initialStep, buyer: { name: "", email: "", whatsapp: "" } };
  const [state, setState] = useState<WizardState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items, totalCents, clearCart } = useCart();

  useEffect(() => {
    // Se veio com initialStep > 0 (ex: "Finalizar Compra" do drawer), começa limpo naquele step
    if (initialStep > 0) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
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

  async function handleSubmitOrder() {
    setLoading(true);
    setError(null);

    const result = await createProductOrder({
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
    });

    setLoading(false);

    if (!result.success || !result.pixQrCode) {
      setError(result.error ?? "Erro ao gerar pagamento");
      return;
    }

    save({
      step: 2,
      paymentId: result.paymentId,
      pixQrCode: result.pixQrCode,
      pixQrCodeUrl: result.pixQrCodeUrl,
      orderId: result.orderId,
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
        <>
          <BuyerInfo
            buyer={state.buyer}
            onChange={(b) => save({ buyer: b })}
            onNext={handleSubmitOrder}
            onBack={() => save({ step: 0 })}
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

      {state.step === 2 && state.pixQrCode && state.paymentId && (
        <PaymentStep
          pixQrCode={state.pixQrCode}
          pixQrCodeUrl={state.pixQrCodeUrl}
          paymentId={state.paymentId}
          totalCents={totalCents}
          onPaid={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            clearCart();
            setState((prev) => ({ ...prev, step: 3, confirmed: true }));
          }}
          onFailed={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 3, confirmed: false }));
          }}
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
