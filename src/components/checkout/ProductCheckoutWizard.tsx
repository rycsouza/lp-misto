"use client";

import React, { useState, useEffect } from "react";
import { CartReview } from "./steps/CartReview";
import { BuyerInfo } from "./steps/BuyerInfo";
import { ShippingStep } from "./steps/ShippingStep";
import type { ShippingAddress, ShippingOption } from "@/lib/shipping/types";
import { PaymentMethodStep } from "./steps/PaymentMethodStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createProductOrder, fetchUpsellOffer } from "@/app/actions/checkout";
import { cartRequiresShipping } from "@/app/actions/shipping";
import { useCart } from "@/hooks/useCart";
import type { UpsellOfferDisplay } from "@/components/checkout/UpsellCard";
import type { CouponValidation } from "@/app/actions/coupon";

const STEP_LABELS = ["Carrinho", "Dados", "Entrega", "Pagamento", "Conclusão"];
const STORAGE_KEY = "misto_product_checkout";

interface WizardState {
  step: number;
  buyer: { name: string; email: string; whatsapp: string };
  cpf?: string;
  shippingAddress?: ShippingAddress;
  shippingOption?: ShippingOption;
  orderId?: string;
  confirmed?: boolean;
  upsellOffer?: UpsellOfferDisplay | null;
  upsellAccepted: boolean;
  upsellGameId: string;
  coupon?: CouponValidation | null;
}

export function ProductCheckoutWizard({
  initialStep = 0,
  initialCouponCode,
  whatsapp,
  shippingEnabled = true,
}: {
  initialStep?: number;
  initialCouponCode?: string | null;
  whatsapp?: string;
  shippingEnabled?: boolean;
}) {
  const defaultState: WizardState = {
    step: initialStep,
    buyer: { name: "", email: "", whatsapp: "" },
    upsellAccepted: false,
    upsellGameId: "",
  };
  const [state, setState] = useState<WizardState>(defaultState);
  const { items, totalCents, clearCart } = useCart();

  useEffect(() => {
    if (initialStep > 0) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch { /* ignore */ }
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState;
        // Não restaura a partir do step de pagamento — recomeça do início
        if (parsed.step >= 3) parsed.step = 1;
        setState({ ...parsed, upsellOffer: undefined });
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(updates: Partial<WizardState>) {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }

  // Busca upsell ao chegar no step de pagamento (step 3)
  React.useEffect(() => {
    if (state.step !== 3) return;
    if (state.upsellOffer !== undefined) return;
    const productIds = items.map((i) => i.productId);
    fetchUpsellOffer({ purchaseType: "product", totalCents, productIds }).then((offer) => {
      save({ upsellOffer: offer });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const shippingCostCents = state.shippingOption?.priceCents ?? 0;

  return (
    <div className="max-w-xl mx-auto">
      {/* Barra de progresso */}
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
              <div
                className={`flex-1 h-px mt-3.5 min-w-2 ${
                  i < state.step ? "bg-primary/40" : "bg-border"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0 — Carrinho */}
      {state.step === 0 && <CartReview onNext={() => save({ step: 1 })} />}

      {/* Step 1 — Dados */}
      {state.step === 1 && (
        <BuyerInfo
          buyer={state.buyer}
          onChange={(b) => save({ buyer: b })}
          onCpfFound={(cpf) => save({ cpf })}
          onNext={async () => {
            if (!shippingEnabled) {
              save({ step: 3 });
              return;
            }
            const productIds = items.map((i) => i.productId);
            const needsShipping = await cartRequiresShipping(productIds);
            save({ step: needsShipping ? 2 : 3 });
          }}
          onBack={() => save({ step: 0 })}
        />
      )}

      {/* Step 2 — Entrega */}
      {state.step === 2 && (
        <ShippingStep
          cartItems={items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPriceCents: i.priceCents,
          }))}
          subtotalCents={totalCents}
          buyerWhatsapp={state.buyer.whatsapp || undefined}
          initial={
            state.shippingAddress && state.shippingOption
              ? { address: state.shippingAddress, option: state.shippingOption }
              : null
          }
          onNext={(address, option) =>
            save({ step: 3, shippingAddress: address, shippingOption: option })
          }
          onBack={() => save({ step: 1 })}
        />
      )}

      {/* Step 3 — Pagamento */}
      {state.step === 3 && (
        <PaymentMethodStep
          totalCents={
            totalCents +
            shippingCostCents +
            (state.upsellAccepted && state.upsellOffer
              ? state.upsellOffer.discountedPriceCents
              : 0) -
            (state.coupon?.discountCents ?? 0)
          }
          upsellOffer={state.upsellOffer ?? null}
          upsellAccepted={state.upsellAccepted}
          upsellGameId={state.upsellGameId}
          games={[]}
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
              shippingAddress: state.shippingAddress ?? null,
              shippingCostCents: shippingCostCents,
              shippingServiceName: state.shippingOption
                ? `${state.shippingOption.company} ${state.shippingOption.name}`.trim()
                : null,
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
                      unitPriceCents: Math.round(
                        state.upsellOffer.discountedPriceCents /
                          (state.upsellOffer.offerQuantity || 1)
                      ),
                      quantity: state.upsellOffer.offerQuantity || 1,
                    }
                  : null,
              couponCode: state.coupon?.code ?? null,
            })
          }
          onPaid={(orderId) => {
            sessionStorage.removeItem(STORAGE_KEY);
            clearCart();
            setState((prev) => ({ ...prev, step: 4, orderId, confirmed: true }));
          }}
          onFailed={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState((prev) => ({ ...prev, step: 4, confirmed: false }));
          }}
          onBack={async () => {
            if (!shippingEnabled) {
              save({ step: 1 });
              return;
            }
            const productIds = items.map((i) => i.productId);
            const needsShipping = await cartRequiresShipping(productIds);
            save({ step: needsShipping ? 2 : 1 });
          }}
        />
      )}

      {/* Step 4 — Conclusão */}
      {state.step === 4 && (
        <ConfirmationStep
          success={state.confirmed === true}
          orderId={state.orderId}
          successMessage={
            state.shippingAddress
              ? `Seu pedido foi confirmado! Enviaremos para ${state.shippingAddress.cidade}/${state.shippingAddress.estado} via ${state.shippingOption ? `${state.shippingOption.company} ${state.shippingOption.name}` : "correios"}. Você receberá o código de rastreio por e-mail.`
              : "Seu pedido foi confirmado! Enviaremos uma confirmação por e-mail em breve."
          }
          whatsapp={whatsapp}
          onRetry={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setState(defaultState);
          }}
        />
      )}
    </div>
  );
}
