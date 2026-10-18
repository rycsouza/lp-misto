/**
 * Período do relatório do sócio-torcedor (puro). Datas são de Brasília (AAAA-MM-DD).
 * Padrão: do dia 1 do mês atual até hoje. Máximo de 400 dias.
 */
import { z } from "zod";
import { todayBrasilia } from "@/lib/date";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;
const DAY_MS = 86_400_000;

export interface MembershipPeriod {
  from: string;
  to: string;
  /** Início do dia `from` em Brasília (inclusivo). */
  start: Date;
  /** Início do dia seguinte a `to` em Brasília (exclusivo). */
  endExclusive: Date;
}

const periodInputSchema = z
  .object({
    from: z.string().regex(DATE_ONLY_RE).optional(),
    to: z.string().regex(DATE_ONLY_RE).optional(),
  })
  .strict();

function isRealDay(s: string): boolean {
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Valida a entrada (vem da query string) e devolve o período. Lança "Período inválido." se errado. */
export function resolveMembershipPeriod(input: unknown, today: string = todayBrasilia()): MembershipPeriod {
  const parsed = periodInputSchema.safeParse(input ?? {});
  if (!parsed.success) throw new Error("Período inválido.");
  const from = parsed.data.from ?? `${today.slice(0, 7)}-01`;
  const to = parsed.data.to ?? today;
  if (!isRealDay(from) || !isRealDay(to) || from > to) throw new Error("Período inválido.");
  const start = new Date(`${from}T00:00:00-03:00`);
  const endExclusive = new Date(new Date(`${to}T00:00:00-03:00`).getTime() + DAY_MS);
  if ((endExclusive.getTime() - start.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
    throw new Error("Período longo demais (máximo de 400 dias).");
  }
  return { from, to, start, endExclusive };
}
