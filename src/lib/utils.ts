import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Percentual de vendidos como texto pt-BR: até 2 casas decimais, sem casas
 * quando o valor é inteiro (ex.: 0 → "0", 12.5 → "12,50", 12.34 → "12,34").
 */
export function formatSoldPct(sold: number, total: number): string {
  if (total <= 0) return "0";
  const r = Math.round((sold / total) * 10000) / 100; // 2 casas
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(".", ",");
}
