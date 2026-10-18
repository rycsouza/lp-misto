"use server";

import { z } from "zod";
import { and, count, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans, membershipPayments, orderItems, orders } from "@/lib/db/schema";
import { requireModule } from "@/lib/admin/auth-guard";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { resolveMembershipPeriod, type MembershipPeriod } from "@/lib/membership/report-period";
import { toCsv } from "@/lib/admin/csv";
import {
  buildMembershipReport,
  buildMembershipReportCsvRows,
  type MemberAggRow,
  type MembershipReport,
  type PaymentAggRow,
} from "@/lib/membership/report";
import { importMembershipPaymentsBatch, type HistoryImportBatch } from "@/lib/membership/payments-ledger";
import type { MembershipPaymentStatus } from "@/lib/membership/ledger-status";

// Relatório financeiro do sócio-torcedor (aba "Sócio-torcedor" da tela de relatórios).
// Funções exportadas: SOMENTE async (regra de "use server"). Valores de contagem e soma
// vêm do Postgres como string em alguns casos: tudo passa por Number().

export interface MembershipReportView extends MembershipReport {
  range: { from: string; to: string };
}

/**
 * Autorização da aba: o relatório de vendas exige "dashboard" (e o kill-switch dela);
 * os números de sócio exigem TAMBÉM "socios" (e o kill-switch dele). Admin passa nos dois.
 */
async function requireMembershipReportAccess() {
  await requireModule("dashboard");
  return requireModule("socios");
}

async function loadMembershipReport(period: MembershipPeriod): Promise<MembershipReportView> {
  const { start, endExclusive } = period;
  const db = await getDb();

  // Pagamentos do período (por data de pagamento), agrupados por plano e status.
  const paymentRows = await db
    .select({
      planId: membershipPayments.planId,
      planName: membershipPlans.name,
      status: membershipPayments.status,
      count: count(),
      valueCents: sql<number>`coalesce(sum(${membershipPayments.valueCents}), 0)`,
      netValueCents: sql<number>`coalesce(sum(${membershipPayments.netValueCents}), 0)`,
      netKnownCount: sql<number>`count(${membershipPayments.netValueCents})`,
    })
    .from(membershipPayments)
    .leftJoin(membershipPlans, eq(membershipPayments.planId, membershipPlans.id))
    .where(
      and(
        inArray(membershipPayments.status, ["confirmed", "received", "refunded", "chargeback"]),
        gte(membershipPayments.paidAt, start),
        lt(membershipPayments.paidAt, endExclusive)
      )
    )
    .groupBy(membershipPayments.planId, membershipPlans.name, membershipPayments.status);

  const payments: PaymentAggRow[] = paymentRows.map((r) => ({
    planId: r.planId ?? null,
    planName: r.planName ?? null,
    status: r.status as MembershipPaymentStatus,
    count: Number(r.count),
    valueCents: Number(r.valueCents),
    netValueCents: Number(r.netValueCents),
    netKnownCount: Number(r.netKnownCount),
  }));

  // Sócios agora (snapshot): status × plano × "em mês grátis" (fim do mês grátis no futuro e sem pagamento).
  const inTrialExpr = sql<boolean>`coalesce((${members.trialEndsAt} > now() and ${members.hasPaid} = false), false)`;
  const memberRows = await db
    .select({
      planId: members.planId,
      planName: membershipPlans.name,
      planPriceCents: membershipPlans.priceCents,
      status: members.status,
      inTrial: inTrialExpr,
      count: count(),
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .groupBy(members.planId, membershipPlans.name, membershipPlans.priceCents, members.status, inTrialExpr);

  const memberAgg: MemberAggRow[] = memberRows.map((r) => ({
    planId: r.planId ?? null,
    planName: r.planName ?? null,
    planPriceCents: r.planPriceCents == null ? null : Number(r.planPriceCents),
    status: r.status,
    inTrial: Boolean(r.inTrial),
    count: Number(r.count),
  }));

  // Adesões (cadastros) e cancelamentos dentro do período.
  const [newRow] = await db
    .select({ n: count() })
    .from(members)
    .where(and(gte(members.createdAt, start), lt(members.createdAt, endExclusive)));
  const [cancelledRow] = await db
    .select({ n: count() })
    .from(members)
    .where(
      and(
        eq(members.status, "cancelled"),
        isNotNull(members.cancelledAt),
        gte(members.cancelledAt, start),
        lt(members.cancelledAt, endExclusive)
      )
    );

  // Mensalidades vencidas do ledger de sócios suspensos (valor realmente em aberto).
  const [overdueRow] = await db
    .select({
      n: count(),
      cents: sql<number>`coalesce(sum(${membershipPayments.valueCents}), 0)`,
    })
    .from(membershipPayments)
    .innerJoin(members, eq(membershipPayments.memberId, members.id))
    .where(and(eq(membershipPayments.status, "overdue"), eq(members.status, "suspended")));

  // Custo dos benefícios: pedidos pagos no período com desconto de sócio / ingresso grátis.
  const paidInPeriod = and(
    eq(orders.status, "paid"),
    gte(orders.createdAt, start),
    lt(orders.createdAt, endExclusive)
  );
  const [discountRow] = await db
    .select({
      orders: sql<number>`count(distinct ${orders.id})`,
      cents: sql<number>`coalesce(-sum(${orderItems.quantity} * ${orderItems.unitPriceCents}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(paidInPeriod, sql`${orderItems.metadata}->>'isMemberDiscount' = 'true'`));
  const [freeRow] = await db
    .select({ qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(paidInPeriod, sql`${orderItems.metadata}->>'isMemberFreeTicket' = 'true'`));

  const report = buildMembershipReport({
    payments,
    members: memberAgg,
    period: { newMembers: Number(newRow?.n ?? 0), cancelledMembers: Number(cancelledRow?.n ?? 0) },
    benefits: {
      memberDiscountOrders: Number(discountRow?.orders ?? 0),
      memberDiscountCents: Number(discountRow?.cents ?? 0),
      freeTicketsRedeemed: Number(freeRow?.qty ?? 0),
    },
    overdue: { count: Number(overdueRow?.n ?? 0), valueCents: Number(overdueRow?.cents ?? 0) },
  });

  return { ...report, range: { from: period.from, to: period.to } };
}

/** Relatório do sócio-torcedor no período (padrão: mês atual). Agregado: sem nomes nem e-mails. */
export async function getMembershipReport(input?: { from?: string; to?: string }): Promise<MembershipReportView> {
  await requireMembershipReportAccess();
  return loadMembershipReport(resolveMembershipPeriod(input));
}

/** CSV do relatório do sócio-torcedor (agregado, células neutralizadas contra injeção de fórmula). */
export async function exportMembershipReportCSV(input?: { from?: string; to?: string }): Promise<string> {
  await requireMembershipReportAccess();
  const period = resolveMembershipPeriod(input);
  const view = await loadMembershipReport(period);
  await logAudit("membership_report_export", "membership_report", null, {
    from: period.from,
    to: period.to,
  });
  return toCsv(buildMembershipReportCsvRows(view));
}

/**
 * Backfill do histórico de mensalidades (admin). Processa um lote de sócios a partir
 * do cursor e devolve `nextCursor` (NULL = terminou). Idempotente. Rate limit por
 * administrador, para não estourar a cota do gateway.
 */
export async function importMembershipPaymentsHistory(input?: {
  afterMemberId?: string | null;
}): Promise<HistoryImportBatch> {
  const session = await requireModule("socios");
  const parsed = z
    .object({ afterMemberId: z.string().uuid().nullable().optional() })
    .strict()
    .safeParse(input ?? {});
  if (!parsed.success) throw new Error("Pedido inválido.");

  const limit = await rateLimit(`membership-history-import:${session.userId}`, 60, 15 * 60);
  if (!limit.ok) throw new Error("Muitas importações em sequência. Aguarde alguns minutos.");

  const batch = await importMembershipPaymentsBatch(parsed.data.afterMemberId ?? null);
  await logAudit("membership_payments_import", "membership_payments", null, {
    processed: batch.processed,
    failed: batch.failed,
    done: batch.nextCursor === null,
  });
  return batch;
}
