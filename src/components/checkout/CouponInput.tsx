"use client";

import { useState } from "react";
import { Tag, X, Loader2, CheckCircle2 } from "lucide-react";
import { validateCoupon } from "@/app/actions/coupon";
import type { CouponValidation } from "@/app/actions/coupon";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface CouponInputProps {
  totalCents: number;
  customerWhatsapp: string;
  applied: CouponValidation | null;
  onApply: (coupon: CouponValidation) => void;
  onRemove: () => void;
}

export function CouponInput({ totalCents, customerWhatsapp, applied, onApply, onRemove }: CouponInputProps) {
  const [open, setOpen] = useState(!!applied);
  const [code, setCode] = useState(applied?.code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const result = await validateCoupon(code.trim(), totalCents, customerWhatsapp.replace(/\D/g, ""));
    setLoading(false);
    if (result.valid) {
      onApply(result);
    } else {
      setError(result.error);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 size={15} className="text-primary shrink-0" />
          <span className="text-foreground font-semibold truncate">{applied.code}</span>
          {applied.description && (
            <span className="text-muted-foreground truncate hidden sm:inline">— {applied.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-primary font-semibold">−{formatPrice(applied.discountCents)}</span>
          <button
            type="button"
            onClick={() => { onRemove(); setCode(""); setError(null); }}
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Remover cupom"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Tag size={14} />
          Tenho um cupom de desconto
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              placeholder="CÓDIGO"
              className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || !code.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setCode(""); setError(null); }}
              className="p-2 bg-secondary border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
