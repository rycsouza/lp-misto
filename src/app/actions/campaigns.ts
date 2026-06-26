"use server";

import { getDb } from "@/lib/db/client";
import { orders, orderItems, products } from "@/lib/db/schema";
import { and, eq, inArray, gte, lt, desc, isNull, asc } from "drizzle-orm";
import { getAdminSession } from "@/app/actions/admin-auth";
import { logAudit } from "@/lib/audit";

export interface CampaignProduct {
  id: string;
  name: string;
}

/** Catálogo de produtos para os filtros de incluir/excluir. */
export async function getCampaignProducts(): Promise<CampaignProduct[]> {
  const session = await getAdminSession();
  if (!session) return [];
  const db = await getDb();
  const rows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .orderBy(asc(products.name));
  return rows;
}

export interface CampaignFilters {
  /** Pedidos que contenham AO MENOS um destes produtos. Vazio = qualquer produto. */
  includeProductIds?: string[];
  /** Pedidos que NÃO contenham nenhum destes produtos. */
  excludeProductIds?: string[];
  /** Status de pagamento elegíveis. Default: ["paid"]. */
  statuses?: ("paid" | "pending")[];
  /** Apenas pedidos de retirada (sem endereço de envio). */
  pickupOnly?: boolean;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface CampaignRecipient {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  createdAt: string;
  totalCents: number;
  productNames: string[];
  hasEmail: boolean;
}

type ItemMeta = { name?: string; isCouponDiscount?: boolean } | null;

/** Resolve os destinatários (um por pedido) que casam com os filtros. */
export async function getCampaignRecipients(
  filters: CampaignFilters
): Promise<CampaignRecipient[]> {
  const session = await getAdminSession();
  if (!session) return [];
  const db = await getDb();

  const statuses: ("paid" | "pending")[] =
    filters.statuses && filters.statuses.length > 0 ? filters.statuses : ["paid"];

  const conds = [inArray(orders.status, statuses)];
  if (filters.pickupOnly) conds.push(isNull(orders.shippingAddress));
  if (filters.from) conds.push(gte(orders.createdAt, new Date(`${filters.from}T00:00:00-03:00`)));
  if (filters.to) conds.push(lt(orders.createdAt, new Date(`${filters.to}T23:59:59.999-03:00`)));

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(2000);

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const items = await db
    .select()
    .from(orderItems)
    .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.type, "product")));

  // Mapa orderId → { productIds, names }
  const byOrder = new Map<string, { productIds: Set<string>; names: string[] }>();
  for (const it of items) {
    if ((it.metadata as ItemMeta)?.isCouponDiscount) continue;
    let entry = byOrder.get(it.orderId);
    if (!entry) {
      entry = { productIds: new Set(), names: [] };
      byOrder.set(it.orderId, entry);
    }
    if (it.referenceId) entry.productIds.add(it.referenceId);
    const name = (it.metadata as ItemMeta)?.name;
    if (name && !entry.names.includes(name)) entry.names.push(name);
  }

  const include = new Set(filters.includeProductIds ?? []);
  const exclude = new Set(filters.excludeProductIds ?? []);

  const out: CampaignRecipient[] = [];
  for (const o of orderRows) {
    const entry = byOrder.get(o.id);
    if (!entry) continue; // pedido sem produto físico → fora da campanha de produtos
    const pids = entry.productIds;

    // Incluir: precisa conter ao menos um dos produtos marcados (se houver filtro)
    if (include.size > 0 && ![...include].some((id) => pids.has(id))) continue;
    // Excluir: não pode conter nenhum dos produtos marcados
    if (exclude.size > 0 && [...exclude].some((id) => pids.has(id))) continue;

    out.push({
      orderId: o.id,
      customerName: o.customerName,
      customerEmail: o.customerEmail ?? "",
      customerWhatsapp: o.customerWhatsapp,
      createdAt: (o.createdAt as Date).toISOString(),
      totalCents: o.totalCents,
      productNames: entry.names,
      hasEmail: !!o.customerEmail,
    });
  }
  return out;
}

export interface CampaignSendResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia o e-mail de campanha para um único pedido. O envio é orquestrado pelo
 * cliente (um pedido por vez, com barra de progresso) para evitar timeout no
 * serverless — mesmo padrão do reenvio de confirmações.
 */
export async function sendCampaignToOrder(
  orderId: string,
  input: { subject: string; body: string; markReady?: boolean }
): Promise<CampaignSendResult> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Não autorizado." };
  }

  const { sendCampaignEmail } = await import("@/lib/email");
  const res = await sendCampaignEmail(orderId, { subject: input.subject, body: input.body });

  if (res.success && input.markReady) {
    try {
      const { markPickupReady } = await import("@/app/actions/pickup");
      await markPickupReady([orderId]);
    } catch {
      /* não bloqueia o envio se a marcação falhar */
    }
  }

  if (res.success) {
    await logAudit("send_campaign_email", "order", orderId);
  }
  return { success: res.success, error: res.error, skipped: res.skipped };
}
