"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  affiliateId: string | null;
}

interface Props {
  affiliateId: string;
  coupons: Coupon[];
  currentCouponId: string | null;
  linkAction: (affiliateId: string, couponId: string | null) => Promise<{ success: boolean; error?: string }>;
}

export function CouponLinkForm({ affiliateId, coupons, currentCouponId, linkAction }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCouponId, setSelectedCouponId] = useState<string>(currentCouponId ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await linkAction(affiliateId, selectedCouponId || null);
      if (!result.success) {
        setError(result.error ?? "Erro ao vincular cupom.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <p className="text-xs text-muted-foreground">
        Vincule um cupom a este afiliado. O cupom aparecerá no portal do afiliado para ele compartilhar com clientes.
      </p>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs text-green-500 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          Cupom vinculado com sucesso.
        </p>
      )}
      <div className="flex gap-2">
        <select
          value={selectedCouponId}
          onChange={(e) => { setSelectedCouponId(e.target.value); setSaved(false); }}
          className="flex-1 border border-border rounded-lg px-3 py-2 bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Sem cupom vinculado</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}{c.description ? ` — ${c.description}` : ""}
              {c.affiliateId && c.affiliateId !== affiliateId ? " (vinculado a outro)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
