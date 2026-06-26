"use server";

import { getDb } from "@/lib/db/client";
import { orders, orderItems } from "@/lib/db/schema";
import { and, eq, ne, desc, isNull } from "drizzle-orm";
import { getAdminSession } from "@/app/actions/admin-auth";
import { logAudit } from "@/lib/audit";
import { ensurePickupCode, normalizePickupCode } from "@/lib/pickup/code";
import { revalidatePath } from "next/cache";

export interface PickupOrderSummary {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  createdAt: string;
  totalCents: number;
  code: string | null;
  fulfillmentStatus: "pending" | "ready" | "delivered";
  deliveredAt: string | null;
  deliveredBy: string | null;
  items: { label: string; qty: number }[];
}

type ItemMeta = { name?: string; size?: string; color?: string; isCouponDiscount?: boolean } | null;

/** Monta o resumo dos itens de produto de um pedido (ignora linhas de cupom). */
async function productItemsFor(orderId: string): Promise<{ label: string; qty: number }[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "product")));
  return rows
    .filter((r) => !((r.metadata as ItemMeta)?.isCouponDiscount))
    .map((r) => {
      const meta = r.metadata as ItemMeta;
      const variation = [meta?.color, meta?.size].filter(Boolean).join(" · ");
      const name = meta?.name ?? "Produto";
      return { label: variation ? `${name} (${variation})` : name, qty: r.quantity };
    });
}

/**
 * Lista os pedidos de retirada pagos ainda não entregues (fila de retirada).
 * Garante o código de cada um. Pedidos que não qualificam como retirada
 * (com envio / sem produto físico) são filtrados via ensurePickupCode → null.
 */
export async function getPendingPickups(): Promise<PickupOrderSummary[]> {
  const session = await getAdminSession();
  if (!session) return [];
  const db = await getDb();

  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "paid"),
        isNull(orders.shippingAddress),
        ne(orders.fulfillmentStatus, "delivered")
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const out: PickupOrderSummary[] = [];
  for (const o of rows) {
    const code = await ensurePickupCode(o.id);
    if (!code) continue; // não é pedido de retirada com produto físico
    const items = await productItemsFor(o.id);
    out.push({
      id: o.id,
      customerName: o.customerName,
      customerWhatsapp: o.customerWhatsapp,
      createdAt: (o.createdAt as Date).toISOString(),
      totalCents: o.totalCents,
      code,
      fulfillmentStatus: o.fulfillmentStatus,
      deliveredAt: o.deliveredAt ? (o.deliveredAt as Date).toISOString() : null,
      deliveredBy: o.deliveredBy ?? null,
      items,
    });
  }
  return out;
}

export type PickupLookupResult =
  | { ok: true; order: PickupOrderSummary }
  | { ok: false; reason: "invalid_code" | "not_found" | "already_delivered" | "error"; message: string };

/** Busca um pedido pelo código de retirada para conferência antes de confirmar. */
export async function lookupPickupByCode(rawCode: string): Promise<PickupLookupResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, reason: "error", message: "Não autenticado." };

  const code = normalizePickupCode(rawCode);
  if (code.length !== 6) {
    return { ok: false, reason: "invalid_code", message: "Informe um código de 6 dígitos." };
  }

  try {
    const db = await getDb();
    const [o] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.pickupCode, code), eq(orders.status, "paid")))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (!o) {
      return { ok: false, reason: "not_found", message: "Nenhum pedido encontrado com este código." };
    }

    const items = await productItemsFor(o.id);
    const summary: PickupOrderSummary = {
      id: o.id,
      customerName: o.customerName,
      customerWhatsapp: o.customerWhatsapp,
      createdAt: (o.createdAt as Date).toISOString(),
      totalCents: o.totalCents,
      code,
      fulfillmentStatus: o.fulfillmentStatus,
      deliveredAt: o.deliveredAt ? (o.deliveredAt as Date).toISOString() : null,
      deliveredBy: o.deliveredBy ?? null,
      items,
    };

    if (o.fulfillmentStatus === "delivered") {
      return { ok: false, reason: "already_delivered", message: "Este pedido já foi retirado." };
    }

    return { ok: true, order: summary };
  } catch (err) {
    console.error("lookupPickupByCode error:", err);
    return { ok: false, reason: "error", message: "Erro ao buscar o pedido." };
  }
}

export interface PickupConfirmResult {
  success: boolean;
  error?: string;
  alreadyDelivered?: boolean;
}

/** Confirma a retirada: marca o pedido como entregue (atômico, evita corrida). */
export async function confirmPickupDelivery(orderId: string): Promise<PickupConfirmResult> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "Não autenticado." };

  try {
    const db = await getDb();
    const updated = await db
      .update(orders)
      .set({
        fulfillmentStatus: "delivered",
        deliveredAt: new Date(),
        deliveredBy: session.name,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "paid"),
          ne(orders.fulfillmentStatus, "delivered")
        )
      )
      .returning({ id: orders.id });

    if (updated.length === 0) {
      return { success: false, alreadyDelivered: true, error: "Pedido já retirado ou inválido." };
    }

    await logAudit("confirm_pickup", "order", orderId);
    revalidatePath("/admin/retirada");
    return { success: true };
  } catch (err) {
    console.error("confirmPickupDelivery error:", err);
    return { success: false, error: "Erro ao confirmar a retirada." };
  }
}

/** Marca um conjunto de pedidos como "pronto para retirada" (sem entregar). */
export async function markPickupReady(orderIds: string[]): Promise<{ updated: number }> {
  const session = await getAdminSession();
  if (!session) return { updated: 0 };
  if (orderIds.length === 0) return { updated: 0 };

  const db = await getDb();
  let updated = 0;
  for (const id of orderIds) {
    const res = await db
      .update(orders)
      .set({ fulfillmentStatus: "ready" })
      .where(and(eq(orders.id, id), eq(orders.fulfillmentStatus, "pending")))
      .returning({ id: orders.id });
    updated += res.length;
  }
  revalidatePath("/admin/retirada");
  return { updated };
}

/** Pedidos retirados recentemente (histórico curto para a tela de validação). */
export async function getRecentPickups(limit = 12): Promise<PickupOrderSummary[]> {
  const session = await getAdminSession();
  if (!session) return [];
  const db = await getDb();

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.fulfillmentStatus, "delivered"))
    .orderBy(desc(orders.deliveredAt))
    .limit(limit);

  return rows.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerWhatsapp: o.customerWhatsapp,
    createdAt: (o.createdAt as Date).toISOString(),
    totalCents: o.totalCents,
    code: o.pickupCode,
    fulfillmentStatus: o.fulfillmentStatus,
    deliveredAt: o.deliveredAt ? (o.deliveredAt as Date).toISOString() : null,
    deliveredBy: o.deliveredBy ?? null,
    items: [],
  }));
}
