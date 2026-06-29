"use client";

import React, { useState, useEffect } from "react";
import { CartReview } from "./steps/CartReview";
import { BuyerInfo } from "./steps/BuyerInfo";
import { ShippingStep } from "./steps/ShippingStep";
import type { ShippingAddress, ShippingOption } from "@/lib/shipping/types";
import type { PickupLocation } from "@/lib/config";
import { PaymentMethodStep } from "./steps/PaymentMethodStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";
import { createProductOrder, fetchUpsellOffer } from "@/app/actions/checkout";
import { cartRequiresShipping } from "@/app/actions/shipping";
import type { OrderSummary } from "./steps/PaymentMethodStep";
import { useCart } from "@/hooks/useCart";
import type { UpsellOfferDisplay } from "@/components/checkout/UpsellCard";
import type { CouponValidation } from "@/app/actions/coupon";

// step = índice interno de navegação (0-4, sendo 2 = Entrega)
const ALL_STEPS = [
  { label: "Carrinho",  step: 0 },
  { label: "Dados",     step: 1 },
  { label: "Entrega",   step: 2 },
  { label: "Pagamento", step: 3 },
  { label: "Conclusão", step: 4 },
];
const STEPS_NO_SHIPPING = ALL_STEPS.filter((s) => s.step !== 2);

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
  hp?: string; // honeypot anti-bot
  idempotencyKey?: string; // gerada ao entrar no pagamento; evita pedido duplicado
}

export function ProductCheckoutWizard({
  initialStep = 0,
  initialCouponCode,
  whatsapp,
  shippingEnabled = true,
  pickupLocations = [],
}: {
  initialStep?: number;
  initialCouponCode?: string | null;
  whatsapp?: string;
  shippingEnabled?: boolean;
  pickupLocations?: PickupLocation[];
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
        // Limpa a chave de idempotência: re-entrar no pagamento gera uma nova.
        setState({ ...parsed, upsellOffer: undefined, idempotencyKey: undefined });
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

  const visibleSteps = shippingEnabled ? ALL_STEPS : STEPS_NO_SHIPPING;
  const currentVisualIndex = visibleSteps.findIndex((s) => s.step === state.step);

  return (
    <div className="max-w-xl mx-auto">
      {/* Barra de progresso */}
      <div className="flex items-start mb-8">
        {visibleSteps.map(({ label, step: stepNum }, i) => (
          <React.Fragment key={stepNum}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i === currentVisualIndex
                    ? "bg-primary text-primary-foreground"
                    : i < currentVisualIndex
                    ? "bg-primary/40 text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  i === currentVisualIndex ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < visibleSteps.length - 1 && (
              <div
                className={`flex-1 h-px mt-3.5 min-w-2 ${
                  i < currentVisualIndex ? "bg-primary/40" : "bg-border"
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
          onHoneypotChange={(v) => save({ hp: v })}
          onNext={async () => {
            if (!shippingEnabled) {
              save({ step: 3, idempotencyKey: crypto.randomUUID() });
              return;
            }
            const productIds = items.map((i) => i.productId);
            const needsShipping = await cartRequiresShipping(productIds);
            save(needsShipping ? { step: 2 } : { step: 3, idempotencyKey: crypto.randomUUID() });
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
            save({ step: 3, shippingAddress: address, shippingOption: option, idempotencyKey: crypto.randomUUID() })
          }
          onBack={() => save({ step: 1 })}
        />
      )}

      {/* Step 3 — Pagamento */}
      {state.step === 3 && (() => {
        const shippingLabel = state.shippingOption
          ? `${state.shippingOption.company} ${state.shippingOption.name}`.trim()
          : undefined;
        const shippingIsFree = state.shippingOption?.id === "free" || state.shippingOption?.priceCents === 0;
        const orderSummary: OrderSummary = {
          items: items.map((item) => ({
            label: [
              item.name,
              item.color && item.size ? `${item.size} / ${item.color}` :
              item.size ? item.size :
              item.color ? item.color : null,
            ].filter(Boolean).join(" · "),
            qty: item.quantity,
            unitPriceCents: item.priceCents,
          })),
          subtotalCents: totalCents,
          shippingCostCents: state.shippingOption !== undefined ? shippingCostCents : undefined,
          shippingLabel: shippingIsFree && shippingLabel ? shippingLabel : shippingLabel,
          shippingIsFreePromo: shippingIsFree && !!state.shippingOption,
        };
        return (
        <PaymentMethodStep
          orderSummary={orderSummary}
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
              // Só identidade + quantidade. Preço e frete são resolvidos no backend.
              items: items.map((i) => ({
                productId: i.productId,
                variantId: i.variantId,
                quantity: i.quantity,
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
                  ? { offerId: state.upsellOffer.id }
                  : null,
              couponCode: state.coupon?.code ?? null,
              _hp: state.hp,
              idempotencyKey: state.idempotencyKey,
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
        );
      })()}

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
          pickupLocations={!state.shippingAddress ? pickupLocations : []}
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
