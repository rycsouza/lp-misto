"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createUpsellOffer, updateUpsellOffer } from "@/app/actions/admin-growth";
import type { UpsellOfferRow, UpsellOfferInput } from "@/app/actions/admin-growth";

type FormState = { success: boolean; id?: string; error?: string } | undefined;

interface UpsellOfferFormProps {
  offer?: UpsellOfferRow;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function UpsellOfferForm({ offer }: UpsellOfferFormProps) {
  const router = useRouter();
  const isEditing = !!offer?.id;

  const [triggerType, setTriggerType] = useState(
    offer?.triggerType ?? "any"
  );
  const [offerType, setOfferType] = useState(offer?.offerType ?? "ticket");

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  function parseFormData(formData: FormData): UpsellOfferInput {
    const priceStr = formData.get("originalPriceCents") as string;
    const minOrderStr = formData.get("minOrderCents") as string;
    const tt = formData.get("triggerType") as UpsellOfferInput["triggerType"];
    const ot = formData.get("offerType") as UpsellOfferInput["offerType"];

    return {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      triggerType: tt,
      triggerProductId:
        tt === "specific_product"
          ? (formData.get("triggerProductId") as string) || null
          : null,
      offerType: ot,
      offerProductId:
        ot === "product"
          ? (formData.get("offerProductId") as string) || null
          : null,
      offerTicketType:
        ot === "ticket"
          ? ((formData.get("offerTicketType") as string) as "inteira" | "meia")
          : null,
      originalPriceCents: Math.round(
        parseFloat(priceStr.replace(",", ".")) * 100
      ),
      discountPct: parseInt(formData.get("discountPct") as string, 10),
      active: formData.get("active") === "on",
      minOrderCents: Math.round(
        parseFloat((minOrderStr || "0").replace(",", ".")) * 100
      ),
      timerSeconds: parseInt(formData.get("timerSeconds") as string, 10),
    };
  }

  async function handleCreate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    return createUpsellOffer(parseFormData(formData));
  }

  async function handleUpdate(
    _prev: FormState,
    formData: FormData
  ): Promise<FormState> {
    return updateUpsellOffer(offer!.id!, parseFormData(formData));
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/upsell");
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={offer?.name ?? ""}
            className={inputClass}
            placeholder="Ex: Ingresso com 20% de desconto"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Descrição (opcional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={offer?.description ?? ""}
            className={inputClass}
            placeholder="Descrição da oferta..."
          />
        </div>

        {/* Trigger */}
        <div>
          <label htmlFor="triggerType" className={labelClass}>
            Tipo de Trigger
          </label>
          <select
            id="triggerType"
            name="triggerType"
            defaultValue={offer?.triggerType ?? "any"}
            onChange={(e) => setTriggerType(e.target.value)}
            className={inputClass}
          >
            <option value="any">Qualquer compra</option>
            <option value="ticket">Compra de ingresso</option>
            <option value="product">Compra de produto</option>
            <option value="specific_product">Produto específico</option>
          </select>
        </div>

        {triggerType === "specific_product" && (
          <div>
            <label htmlFor="triggerProductId" className={labelClass}>
              ID do Produto (trigger)
            </label>
            <input
              id="triggerProductId"
              name="triggerProductId"
              type="text"
              defaultValue={offer?.triggerProductId ?? ""}
              className={inputClass}
              placeholder="UUID do produto"
            />
          </div>
        )}

        {/* Offer */}
        <div>
          <label htmlFor="offerType" className={labelClass}>
            Tipo de Oferta
          </label>
          <select
            id="offerType"
            name="offerType"
            defaultValue={offer?.offerType ?? "ticket"}
            onChange={(e) => setOfferType(e.target.value)}
            className={inputClass}
          >
            <option value="ticket">Ingresso</option>
            <option value="product">Produto</option>
          </select>
        </div>

        {offerType === "ticket" && (
          <div>
            <label htmlFor="offerTicketType" className={labelClass}>
              Tipo de Ingresso
            </label>
            <select
              id="offerTicketType"
              name="offerTicketType"
              defaultValue={offer?.offerTicketType ?? "inteira"}
              className={inputClass}
            >
              <option value="inteira">Inteira</option>
              <option value="meia">Meia</option>
            </select>
          </div>
        )}

        {offerType === "product" && (
          <div>
            <label htmlFor="offerProductId" className={labelClass}>
              ID do Produto Ofertado
            </label>
            <input
              id="offerProductId"
              name="offerProductId"
              type="text"
              defaultValue={offer?.offerProductId ?? ""}
              className={inputClass}
              placeholder="UUID do produto"
            />
          </div>
        )}

        {/* Pricing */}
        <div>
          <label htmlFor="originalPriceCents" className={labelClass}>
            Preço Original (R$)
          </label>
          <input
            id="originalPriceCents"
            name="originalPriceCents"
            type="text"
            required
            defaultValue={
              offer?.originalPriceCents
                ? formatPrice(offer.originalPriceCents)
                : ""
            }
            className={inputClass}
            placeholder="Ex: 50,00"
          />
        </div>

        <div>
          <label htmlFor="discountPct" className={labelClass}>
            Desconto (%)
          </label>
          <input
            id="discountPct"
            name="discountPct"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={offer?.discountPct ?? 0}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="minOrderCents" className={labelClass}>
            Pedido Mínimo (R$)
          </label>
          <input
            id="minOrderCents"
            name="minOrderCents"
            type="text"
            defaultValue={
              offer?.minOrderCents ? formatPrice(offer.minOrderCents) : "0,00"
            }
            className={inputClass}
            placeholder="0,00"
          />
        </div>

        <div>
          <label htmlFor="timerSeconds" className={labelClass}>
            Timer (segundos)
          </label>
          <input
            id="timerSeconds"
            name="timerSeconds"
            type="number"
            min={0}
            required
            defaultValue={offer?.timerSeconds ?? 300}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={offer?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Ativo
        </label>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : isEditing ? "Salvar Oferta" : "Criar Oferta"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/upsell")}
          className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
