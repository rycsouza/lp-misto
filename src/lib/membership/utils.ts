import { randomUUID } from "crypto";

// ─── CPF ─────────────────────────────────────────────────────────────────────
// Fonte única em @/lib/cpf (módulo puro, seguro no client). Reexportado aqui
// para não quebrar os imports existentes.
export { normalizeCPF, formatCPF, validateCPF } from "@/lib/cpf";

// ─── DISCOUNTS ───────────────────────────────────────────────────────────────

// Regra pura em ./member-pricing (compartilhada com o client). Reexportada aqui.
export { computeMemberDiscount } from "./member-pricing";

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
