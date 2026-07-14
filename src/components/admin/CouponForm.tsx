"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCoupon, updateCoupon } from "@/app/actions/admin-coupons";
import type { CouponRow, CouponInput } from "@/app/actions/admin-coupons";

type FormState = { success: boolean; error?: string } | undefined;

interface CouponFormProps {
  coupon?: CouponRow;
}

const inputClass = "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm text-muted-foreground mb-1 block";

function parseBRL(str: string): number {
  const clean = str.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function formatBRL(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function CouponForm({ coupon }: CouponFormProps) {
  const router = useRouter();
  const isEditing = !!coupon?.id;

  const [discountType, setDiscountType] = useState<"pct" | "fixed">(coupon?.discountType ?? "pct");
  const [discountValue, setDiscountValue] = useState(
    coupon ? (coupon.discountType === "fixed" ? formatBRL(coupon.discountValue) : String(coupon.discountValue)) : ""
  );
  const [minOrderValue, setMinOrderValue] = useState(
    coupon?.minOrderCents ? formatBRL(coupon.minOrderCents) : ""
  );

  function parseFormData(fd: FormData): CouponInput {
    const dt = fd.get("discountType") as "pct" | "fixed";
    const rawValue = discountValue.replace(",", ".");
    const dv = dt === "fixed" ? parseBRL(discountValue) : Math.min(100, Math.max(0, parseInt(rawValue) || 0));
    const expiresAt = fd.get("expiresAt") as string;
    const maxUsages = fd.get("maxUsages") as string;
    const maxUsagesPerCustomer = fd.get("maxUsagesPerCustomer") as string;

    return {
      code: (fd.get("code") as string).trim().toUpperCase(),
      description: (fd.get("description") as string) || null,
      discountType: dt,
      discountValue: dv,
      appliesTo: fd.get("appliesTo") as "order" | "tickets" | "products",
      minOrderCents: parseBRL(minOrderValue),
      maxUsages: maxUsages ? parseInt(maxUsages) || null : null,
      maxUsagesPerCustomer: maxUsagesPerCustomer ? parseInt(maxUsagesPerCustomer) || null : null,
      expiresAt: expiresAt || null,
      active: fd.get("active") === "on",
    };
  }

  async function handleCreate(_prev: FormState, fd: FormData): Promise<FormState> {
    const res = await createCoupon(parseFormData(fd));
    return res.id ? { success: true } : { success: false, error: res.error };
  }
  async function handleUpdate(_prev: FormState, fd: FormData): Promise<FormState> {
    return updateCoupon(coupon!.id, parseFormData(fd));
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) router.push("/admin/cupons");
  }, [state, router]);

  const expiresAtDefault = coupon?.expiresAt
    ? new Date(coupon.expiresAt).toISOString().slice(0, 16)
    : "";

  return (
    <form action={action} className="flex flex-col gap-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="code" className={labelClass}>Código *</label>
          <input id="code" name="code" type="text" required
            defaultValue={coupon?.code ?? ""}
            placeholder="BLACKFRIDAY10"
            className={`${inputClass} uppercase tracking-widest font-mono`} />
          <p className="text-xs text-muted-foreground mt-1">Será convertido para maiúsculas automaticamente</p>
        </div>
        <div>
          <label htmlFor="appliesTo" className={labelClass}>Aplica-se a</label>
          <select id="appliesTo" name="appliesTo" defaultValue={coupon?.appliesTo ?? "order"} className={`form-select ${inputClass.replace("px-3", "pl-3 pr-9")}`}>
            <option value="order">Pedido inteiro</option>
            <option value="tickets">Apenas ingressos</option>
            <option value="products">Apenas produtos</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Descrição interna (opcional)</label>
        <input id="description" name="description" type="text"
          defaultValue={coupon?.description ?? ""}
          placeholder="Cupom para parceiros — campanha junho 2025"
          className={inputClass} />
      </div>

      <hr className="border-border" />

      <div>
        <p className="text-sm font-medium text-foreground mb-3">Desconto</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="discountType" className={labelClass}>Tipo</label>
            <select id="discountType" name="discountType" value={discountType}
              onChange={(e) => { setDiscountType(e.target.value as "pct" | "fixed"); setDiscountValue(""); }}
              className={`form-select ${inputClass.replace("px-3", "pl-3 pr-9")}`}>
              <option value="pct">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label htmlFor="discountValue" className={labelClass}>
              {discountType === "pct" ? "Percentual (0–100)" : "Valor (R$)"}
            </label>
            <div className="relative">
              {discountType === "fixed" && (
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
              )}
              <input
                id="discountValue"
                type="text"
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "pct" ? "10" : "0,00"}
                className={discountType === "fixed" ? `${inputClass} pl-8` : inputClass}
                required
              />
              {discountType === "pct" && (
                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      <div>
        <p className="text-sm font-medium text-foreground mb-3">Condições de uso</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Valor mínimo do pedido</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
              <input type="text" inputMode="decimal" value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="0,00" className={`${inputClass} pl-8`} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para sem mínimo</p>
          </div>
          <div>
            <label htmlFor="expiresAt" className={labelClass}>Válido até</label>
            <input id="expiresAt" name="expiresAt" type="datetime-local"
              defaultValue={expiresAtDefault}
              className={inputClass} />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para sem expiração</p>
          </div>
          <div>
            <label htmlFor="maxUsages" className={labelClass}>Limite total de usos</label>
            <input id="maxUsages" name="maxUsages" type="number" min={1}
              defaultValue={coupon?.maxUsages ?? ""}
              placeholder="Ilimitado"
              className={inputClass} />
          </div>
          <div>
            <label htmlFor="maxUsagesPerCustomer" className={labelClass}>Limite por cliente</label>
            <input id="maxUsagesPerCustomer" name="maxUsagesPerCustomer" type="number" min={1}
              defaultValue={coupon?.maxUsagesPerCustomer ?? ""}
              placeholder="Ilimitado"
              className={inputClass} />
          </div>
        </div>
      </div>

      <hr className="border-border" />

      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input type="checkbox" name="active" defaultChecked={coupon?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input" />
          Cupom ativo
        </label>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
          {pending ? "Salvando..." : isEditing ? "Salvar Cupom" : "Criar Cupom"}
        </button>
        <button type="button" onClick={() => router.push("/admin/cupons")}
          className="bg-secondary border border-border text-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}
