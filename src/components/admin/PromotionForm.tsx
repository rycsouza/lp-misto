"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createPromotion, updatePromotion } from "@/app/actions/admin-promotions";
import type { PromotionRow, PromotionInput } from "@/app/actions/admin-promotions";

type FormState = { success: boolean; id?: string; error?: string } | undefined;

interface PromotionFormProps {
  promotion?: PromotionRow;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseFormData(fd: FormData): PromotionInput {
  return {
    name: fd.get("name") as string,
    description: (fd.get("description") as string) || null,
    discountType: fd.get("discountType") as "pct" | "fixed",
    discountValue: parseInt(fd.get("discountValue") as string, 10),
    appliesTo: fd.get("appliesTo") as "all" | "tickets" | "products",
    minOrderCents: Math.round(parseFloat(((fd.get("minOrder") as string) || "0").replace(",", ".")) * 100),
    startsAt: new Date(fd.get("startsAt") as string),
    endsAt: new Date(fd.get("endsAt") as string),
    active: fd.get("active") === "on",
    flashSale: fd.get("flashSale") === "on",
  };
}

export function PromotionForm({ promotion }: PromotionFormProps) {
  const router = useRouter();
  const isEditing = !!promotion?.id;

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  async function handleCreate(_prev: FormState, fd: FormData): Promise<FormState> {
    return createPromotion(parseFormData(fd));
  }

  async function handleUpdate(_prev: FormState, fd: FormData): Promise<FormState> {
    return updatePromotion(promotion!.id, parseFormData(fd));
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) router.push("/admin/promocoes");
  }, [state, router]);

  const now = new Date();
  const defaultStart = promotion?.startsAt ? toDatetimeLocal(promotion.startsAt) : toDatetimeLocal(now);
  const defaultEnd = promotion?.endsAt
    ? toDatetimeLocal(promotion.endsAt)
    : toDatetimeLocal(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

  return (
    <form action={action} className="flex flex-col gap-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>Nome *</label>
          <input id="name" name="name" type="text" required defaultValue={promotion?.name ?? ""} className={inputClass} placeholder="Ex: Desconto de Inauguração" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>Descrição (opcional)</label>
          <input id="description" name="description" type="text" defaultValue={promotion?.description ?? ""} className={inputClass} placeholder="Ex: 10% de desconto em todos os ingressos" />
        </div>

        <div>
          <label htmlFor="discountType" className={labelClass}>Tipo de desconto *</label>
          <select id="discountType" name="discountType" defaultValue={promotion?.discountType ?? "pct"} className={`form-select ${inputClass.replace("px-3", "pl-3 pr-9")}`}>
            <option value="pct">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
          </select>
        </div>

        <div>
          <label htmlFor="discountValue" className={labelClass}>Valor do desconto *</label>
          <input id="discountValue" name="discountValue" type="number" min={1} required defaultValue={promotion?.discountValue ?? 10} className={inputClass} placeholder="Ex: 10 (para 10% ou R$10,00)" />
          <p className="text-xs text-muted-foreground mt-1">Para percentual: 1–100. Para fixo: valor em reais (ex: 10 = R$10,00).</p>
        </div>

        <div>
          <label htmlFor="appliesTo" className={labelClass}>Aplica a *</label>
          <select id="appliesTo" name="appliesTo" defaultValue={promotion?.appliesTo ?? "all"} className={`form-select ${inputClass.replace("px-3", "pl-3 pr-9")}`}>
            <option value="all">Tudo (ingressos + produtos)</option>
            <option value="tickets">Apenas ingressos</option>
            <option value="products">Apenas produtos (loja)</option>
          </select>
        </div>

        <div>
          <label htmlFor="minOrder" className={labelClass}>Pedido mínimo (R$)</label>
          <input id="minOrder" name="minOrder" type="number" min={0} step="0.01" defaultValue={promotion ? (promotion.minOrderCents / 100).toFixed(2) : "0"} className={inputClass} placeholder="0,00" />
          <p className="text-xs text-muted-foreground mt-1">Deixe 0 para sem mínimo.</p>
        </div>

        <div>
          <label htmlFor="startsAt" className={labelClass}>Início *</label>
          <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={defaultStart} className={inputClass} />
        </div>

        <div>
          <label htmlFor="endsAt" className={labelClass}>Fim *</label>
          <input id="endsAt" name="endsAt" type="datetime-local" required defaultValue={defaultEnd} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} className="w-4 h-4 rounded border-border bg-input" />
          Ativa
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input type="checkbox" name="flashSale" defaultChecked={promotion?.flashSale ?? false} className="w-4 h-4 rounded border-border bg-input" />
          Flash Sale (exibe contador regressivo na loja)
        </label>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
          {pending ? "Salvando..." : isEditing ? "Salvar Promoção" : "Criar Promoção"}
        </button>
        <button type="button" onClick={() => router.push("/admin/promocoes")} className="bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
