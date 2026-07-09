import { randomUUID } from "crypto";

// ─── CPF ─────────────────────────────────────────────────────────────────────
// Fonte única em @/lib/cpf (módulo puro, seguro no client). Reexportado aqui
// para não quebrar os imports existentes.
export { normalizeCPF, formatCPF, validateCPF } from "@/lib/cpf";

// ─── DISCOUNTS ───────────────────────────────────────────────────────────────

export function computeMemberDiscount(
  baseCents: number,
  discountPct: number
): number {
  if (discountPct <= 0 || baseCents <= 0) return 0;
  const pct = Math.min(100, Math.max(0, discountPct));
  return Math.round((baseCents * pct) / 100);
}

export function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ─── MEMBER CARD TOKEN ───────────────────────────────────────────────────────

export function generateMemberCardToken(): string {
  return randomUUID();
}

// ─── PHONE ───────────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}
