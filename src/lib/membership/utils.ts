import { randomUUID } from "crypto";

// ─── CPF ─────────────────────────────────────────────────────────────────────

export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function formatCPF(cpf: string): string {
  const d = normalizeCPF(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function validateCPF(cpf: string): boolean {
  const d = normalizeCPF(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // all same digit (e.g. 111.111.111-11)

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(d[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 >= 10) check2 = 0;
  if (check2 !== parseInt(d[10])) return false;

  return true;
}

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
