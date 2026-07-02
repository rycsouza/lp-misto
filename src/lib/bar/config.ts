import { getAllSiteConfig } from "@/lib/db/queries";

/** Configuração do bar, guardada no KV site_config (chaves `bar.*`). */
export interface BarConfig {
  /** "percent" = % sobre o subtotal · "fixed" = valor fixo em centavos por ficha */
  serviceFeeType: "percent" | "fixed";
  /** percent: 0–100 · fixed: centavos */
  serviceFeeValue: number;
  /** pedido mínimo em centavos (0 = sem mínimo) */
  minOrderCents: number;
}

export async function getBarConfig(): Promise<BarConfig> {
  const rows = await getAllSiteConfig();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const type = map.get("bar.serviceFeeType") === "fixed" ? "fixed" : "percent";
  const value = Math.max(0, parseInt(map.get("bar.serviceFeeValue") ?? "0", 10) || 0);
  const min = Math.max(0, parseInt(map.get("bar.minOrderCents") ?? "0", 10) || 0);
  return { serviceFeeType: type, serviceFeeValue: value, minOrderCents: min };
}

/** Taxa de serviço em centavos para um subtotal, dada a config. */
export function computeServiceFeeCents(subtotalCents: number, cfg: BarConfig): number {
  if (cfg.serviceFeeType === "fixed") return cfg.serviceFeeValue;
  return Math.round(subtotalCents * (cfg.serviceFeeValue / 100));
}
