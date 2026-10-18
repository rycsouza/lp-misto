/**
 * Ledger local das mensalidades do sócio-torcedor (alimenta os relatórios).
 *
 * REGRA: os valores são sempre LIDOS do gateway (listSubscriptionPayments). As
 * funções aqui recebem só o id da assinatura — nunca valores do corpo de webhook.
 * A gravação é upsert por `gateway_payment_id`: reprocessar a mesma cobrança não
 * duplica linha. Erros propagam para quem chama decidir (webhook: só log, sempre 200).
 */
import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPayments } from "@/lib/db/schema";
import { getSubscriptionGateway } from "@/lib/payment/subscription-factory";
import type { SubscriptionGateway } from "@/lib/payment/subscription-types";
import { toLedgerRow, type LedgerPaymentRow } from "./ledger-status";

type Db = Awaited<ReturnType<typeof getDb>>;

export type LedgerRecordOutcome =
  | { status: "recorded"; upserted: number; skipped: number }
  /** Nenhum sócio com essa assinatura: nada é gravado. */
  | { status: "not_found" }
  /** Gateway ativo não lista cobranças (ex.: Mercado Pago): sem ledger. */
  | { status: "unsupported" };

interface LedgerGateway {
  gateway: SubscriptionGateway;
  slug: string;
}

interface MemberRef {
  id: string;
  planId: string | null;
  subscriptionId: string;
}

async function loadLedgerGateway(): Promise<LedgerGateway | null> {
  const active = await getSubscriptionGateway();
  if (!active?.gateway.listSubscriptionPayments) return null;
  return { gateway: active.gateway, slug: active.slug };
}

/**
 * Reconsulta as cobranças da assinatura no gateway e faz o upsert no ledger.
 * Marca `ledger_synced_at` mesmo quando falha, para o cron girar o lote inteiro
 * (sem isso, um sócio com erro persistente bloquearia a fila).
 */
async function recordMemberPayments(
  db: Db,
  ledger: LedgerGateway,
  member: MemberRef
): Promise<{ upserted: number; skipped: number }> {
  try {
    const payments = await ledger.gateway.listSubscriptionPayments!(member.subscriptionId);

    // Dedupe por id dentro do lote: a paginação por offset pode repetir uma cobrança
    // se outra entrar entre as páginas, e o ON CONFLICT não aceita a mesma linha 2x.
    const byId = new Map<string, LedgerPaymentRow>();
    let skipped = 0;
    for (const p of payments) {
      const row = toLedgerRow({
        id: p.gatewayPaymentId,
        valueCents: p.valueCents,
        netValueCents: p.netValueCents,
        status: p.status,
        dueDate: p.dueDate,
        paymentDate: p.paymentDate,
        billingType: p.billingType,
      });
      if (row) byId.set(row.gatewayPaymentId, row);
      else skipped++;
    }

    const rows = [...byId.values()];
    if (rows.length > 0) {
      const now = new Date();
      await db
        .insert(membershipPayments)
        .values(
          rows.map((r) => ({
            memberId: member.id,
            // Plano vigente na 1ª gravação: não é sobrescrito depois (ver schema).
            planId: member.planId,
            gatewaySlug: ledger.slug,
            subscriptionId: member.subscriptionId,
            gatewayPaymentId: r.gatewayPaymentId,
            valueCents: r.valueCents,
            netValueCents: r.netValueCents,
            status: r.status,
            dueDate: r.dueDate,
            paidAt: r.paidAt,
            billingType: r.billingType,
            createdAt: now,
            updatedAt: now,
          }))
        )
        .onConflictDoUpdate({
          target: membershipPayments.gatewayPaymentId,
          set: {
            valueCents: sql`excluded.value_cents`,
            netValueCents: sql`excluded.net_value_cents`,
            status: sql`excluded.status`,
            dueDate: sql`excluded.due_date`,
            // Estorno não apaga a data em que o dinheiro entrou: mantém a já gravada.
            paidAt: sql`coalesce(excluded.paid_at, ${membershipPayments.paidAt})`,
            billingType: sql`excluded.billing_type`,
            updatedAt: now,
          },
        });
    }
    return { upserted: rows.length, skipped };
  } finally {
    await db
      .update(members)
      .set({ ledgerSyncedAt: new Date() })
      .where(eq(members.id, member.id))
      .catch(() => undefined);
  }
}

/** Registra as mensalidades de UMA assinatura (webhook PAYMENT_*). */
export async function recordSubscriptionPayments(subscriptionId: string): Promise<LedgerRecordOutcome> {
  if (!subscriptionId) return { status: "not_found" };
  const db = await getDb();
  const [member] = await db
    .select({ id: members.id, planId: members.planId })
    .from(members)
    .where(eq(members.subscriptionId, subscriptionId))
    .limit(1);
  if (!member) return { status: "not_found" };

  const ledger = await loadLedgerGateway();
  if (!ledger) return { status: "unsupported" };

  const result = await recordMemberPayments(db, ledger, { ...member, subscriptionId });
  return { status: "recorded", ...result };
}

export interface RecentLedgerResult {
  checked: number;
  recorded: number;
  failed: number;
}

/**
 * Cron diário: sócios ativos/suspensos, os MENOS recentemente sincronizados primeiro
 * (NULL antes). Lote limitado para não estourar o tempo nem a cota do gateway.
 */
export async function recordRecentMembershipPayments(limit = 50): Promise<RecentLedgerResult> {
  const db = await getDb();
  const ledger = await loadLedgerGateway();
  if (!ledger) return { checked: 0, recorded: 0, failed: 0 };

  const rows = await db
    .select({ id: members.id, planId: members.planId, subscriptionId: members.subscriptionId })
    .from(members)
    .where(
      and(
        isNotNull(members.subscriptionId),
        inArray(members.status, ["active", "suspended"])
      )
    )
    .orderBy(sql`${members.ledgerSyncedAt} asc nulls first`)
    .limit(limit);

  let recorded = 0;
  let failed = 0;
  for (const m of rows) {
    try {
      await recordMemberPayments(db, ledger, { id: m.id, planId: m.planId, subscriptionId: m.subscriptionId! });
      recorded++;
    } catch (err) {
      failed++;
      logLedgerError("sincronização diária", m.id, err);
    }
  }
  return { checked: rows.length, recorded, failed };
}

export interface HistoryImportBatch {
  supported: boolean;
  processed: number;
  failed: number;
  /** Id do último sócio do lote; NULL quando não há mais sócios a percorrer. */
  nextCursor: string | null;
}

/**
 * Backfill do histórico (admin): percorre TODOS os sócios com assinatura (inclusive
 * cancelados), em lotes por id. Idempotente: rodar de novo só atualiza.
 */
export async function importMembershipPaymentsBatch(
  afterMemberId: string | null,
  limit = HISTORY_BATCH_SIZE
): Promise<HistoryImportBatch> {
  const db = await getDb();
  const ledger = await loadLedgerGateway();
  if (!ledger) return { supported: false, processed: 0, failed: 0, nextCursor: null };

  const conditions = [isNotNull(members.subscriptionId)];
  if (afterMemberId) conditions.push(gt(members.id, afterMemberId));
  const rows = await db
    .select({ id: members.id, planId: members.planId, subscriptionId: members.subscriptionId })
    .from(members)
    .where(and(...conditions))
    .orderBy(asc(members.id))
    .limit(limit);

  let failed = 0;
  for (const m of rows) {
    try {
      await recordMemberPayments(db, ledger, { id: m.id, planId: m.planId, subscriptionId: m.subscriptionId! });
    } catch (err) {
      failed++;
      logLedgerError("importação do histórico", m.id, err);
    }
  }
  const last = rows[rows.length - 1];
  return {
    supported: true,
    processed: rows.length,
    failed,
    nextCursor: rows.length === limit && last ? last.id : null,
  };
}

/** Sócios por lote do backfill: ~1 chamada ao gateway por sócio, cabe no tempo de uma action. */
export const HISTORY_BATCH_SIZE = 25;

/** Log sem dados pessoais: só o id interno do sócio e a mensagem truncada. */
function logLedgerError(context: string, memberId: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[membership-ledger] falha na ${context} (sócio ${memberId}): ${msg.slice(0, 200)}`);
}
