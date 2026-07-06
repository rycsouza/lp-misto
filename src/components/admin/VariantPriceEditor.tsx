"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateVariant } from "@/app/actions/admin-shop";

function reaisToCents(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100);
}
function centsToReais(c: number | null): string {
  return c == null ? "" : (c / 100).toFixed(2).replace(".", ",");
}

/** Edição inline do preço próprio de uma variante. Vazio = usa o preço do produto. */
export function VariantPriceEditor({
  variantId,
  initialPriceCents,
  placeholder,
}: {
  variantId: string;
  initialPriceCents: number | null;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(centsToReais(initialPriceCents));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = value !== centsToReais(initialPriceCents);

  async function save() {
    setSaving(true);
    await updateVariant(variantId, { priceCents: reaisToCents(value) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">R$</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-20 bg-input border border-border rounded-md px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {dirty && (
        <button type="button" onClick={save} disabled={saving} className="text-xs text-primary hover:underline disabled:opacity-50">
          {saving ? "…" : "salvar"}
        </button>
      )}
      {saved && <span className="text-xs text-green-600">✓</span>}
    </div>
  );
}
