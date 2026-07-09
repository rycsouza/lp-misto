"use server";

import { z } from "zod";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  cantinaItems,
  cantinaVouchers,
  customers,
  orderItems,
  orders,
  payments,
} from "@/lib/db/schema";
import { getGatewayForMethod } from "@/lib/payment";
import { applyGatewayStatus } from "@/lib/payment/sync";
import { getCantinaConfig, computeCantinaServiceFeeCents } from "@/lib/cantina/config";
import { validateCPF } from "@/lib/cpf";

// Tetos defensivos (o client nunca define preço; só identidade + quantidade).
const MAX_QTY_PER_LINE = 50;
const MAX_LINES = 40;

const buyerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

const lineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(MAX_QTY_PER_LINE),
});

interface CardPaymentData {
  cardToken: string;
  installments: number;
  paymentMethodId: string;
  identificationNumber: string;
}
interface AsaasCardPaymentData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
}

export interface CantinaOrderResult {
  success: boolean;
  orderId?: string;
  paymentId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: string;
  cardStatus?: "approved" | "in_process" | "rejected";
  cardStatusDetail?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PÚBLICO — catálogo à venda (sem jogo)
// ─────────────────────────────────────────────────────────────────────────────

export interface CantinaCatalogItem {
  itemId: string;
  name: string;
  description: string | null;
  category: "bebida" | "comida" | "outro";
  imageUrl: string | null;
  needsPrep: boolean;
  priceCents: number;
  soldOut: boolean;
}

/** Itens ativos disponíveis para compra antecipada (com disponibilidade global). */
export async function getCantinaCatalog(): Promise<CantinaCatalogItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cantinaItems)
    .where(eq(cantinaItems.active, true))
    .orderBy(asc(cantinaItems.sortOrder), asc(cantinaItems.name));

  return rows.map((r) => ({
    itemId: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    imageUrl: r.imageUrl,
    needsPrep: r.needsPrep,
    priceCents: r.priceCents,
    soldOut: r.stockCap != null && r.stockSold >= r.stockCap,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PÚBLICO — compra (reaproveita orders/payments) → gera vales
// ─────────────────────────────────────────────────────────────────────────────

interface CreateCantinaOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  items: { itemId: string; quantity: number }[];
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  customerCpf?: string;
  _hp?: string;
  idempotencyKey?: string;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

/** Idempotência: devolve o mesmo pedido/pagamento se a chave já foi usada. */
async function findCantinaOrderByIdempotencyKey(key: string): Promise<CantinaOrderResult | null> {
  try {
    const db = await getDb();
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.idempotencyKey, key))
      .limit(1);
    if (!order) return null;
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return {
      success: true,
      orderId: order.id,
      paymentId: payment?.id,
      pixQrCode: payment?.pixQrCode ?? undefined,
      pixQrCodeUrl: payment?.pixQrCodeUrl ?? undefined,
      pixExpiresAt: payment?.pixExpiresAt?.toISOString(),
      cardStatus:
        payment?.status === "paid" ? "approved" : payment?.status === "failed" ? "rejected" : undefined,
    };
  } catch {
    return null;
  }
}

async function upsertCustomer(name: string, email: string, whatsapp: string, cpf?: string | null): Promise<string> {
  const db = await getDb();
  const normalized = whatsapp.replace(/\D/g, "");
  const cpfNormalized = cpf && validateCPF(cpf) ? cpf.replace(/\D/g, "") : null;
  const [row] = await db
    .insert(customers)
    .values({ name, email, whatsapp: normalized, cpf: cpfNormalized })
    .onConflictDoUpdate({
      target: customers.whatsapp,
      set: { name, email, ...(cpfNormalized ? { cpf: cpfNormalized } : {}), updatedAt: new Date() },
    })
    .returning({ id: customers.id });
  return row.id;
}

export async function createCantinaOrder(input: CreateCantinaOrderInput): Promise<CantinaOrderResult> {
  const db = await getDb();
  if (input._hp) return { success: false, error: "Não foi possível processar a compra." };

  const buyer = buyerSchema.safeParse(input.buyer);
  if (!buyer.success) return { success: false, error: buyer.error.issues[0]?.message ?? "Dados inválidos" };
  if (input.customerCpf && !validateCPF(input.customerCpf)) {
    return { success: false, error: "CPF inválido. Confira o número informado." };
  }

  // Idempotência antes de qualquer baixa de estoque.
  if (input.idempotencyKey) {
    const existing = await findCantinaOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  const linesParse = z.array(lineSchema).min(1).max(MAX_LINES).safeParse(input.items);
  if (!linesParse.success) return { success: false, error: "Itens inválidos." };

  // Mescla quantidades por item (evita linhas duplicadas dobrarem estoque).
  const qtyByItem = new Map<string, number>();
  for (const l of linesParse.data) {
    qtyByItem.set(l.itemId, (qtyByItem.get(l.itemId) ?? 0) + l.quantity);
  }
  const itemIds = [...qtyByItem.keys()];

  // Preço/nome/preparo AUTORITATIVOS do catálogo.
  const itemRows = await db
    .select({
      id: cantinaItems.id,
      name: cantinaItems.name,
      needsPrep: cantinaItems.needsPrep,
      priceCents: cantinaItems.priceCents,
      active: cantinaItems.active,
    })
    .from(cantinaItems)
    .where(inArray(cantinaItems.id, itemIds));
  const itemMap = new Map(itemRows.map((i) => [i.id, i]));

  const resolved: {
    itemId: string;
    name: string;
    needsPrep: boolean;
    quantity: number;
    unitPriceCents: number;
  }[] = [];
  for (const [itemId, quantity] of qtyByItem) {
    const it = itemMap.get(itemId);
    if (!it || !it.active) {
      return { success: false, error: "Item indisponível. Atualize a página e tente novamente." };
    }
    resolved.push({ itemId, name: it.name, needsPrep: it.needsPrep, quantity, unitPriceCents: it.priceCents });
  }

  const subtotalCents = resolved.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);

  const cfg = await getCantinaConfig();
  if (cfg.minOrderCents > 0 && subtotalCents < cfg.minOrderCents) {
    return {
      success: false,
      error: `Compra mínima de R$ ${(cfg.minOrderCents / 100).toFixed(2).replace(".", ",")}.`,
    };
  }
  const serviceFeeCents = computeCantinaServiceFeeCents(subtotalCents, cfg);
  const totalCents = subtotalCents + serviceFeeCents;

  try {
    // Baixa de estoque GLOBAL atômica por item (stock_cap NULL = ilimitado).
    for (const item of resolved) {
      const updated = await db
        .update(cantinaItems)
        .set({ stockSold: sql`${cantinaItems.stockSold} + ${item.quantity}` })
        .where(
          and(
            eq(cantinaItems.id, item.itemId),
            eq(cantinaItems.active, true),
            sql`(${cantinaItems.stockCap} IS NULL OR ${cantinaItems.stockSold} + ${item.quantity} <= ${cantinaItems.stockCap})`
          )
        )
        .returning({ id: cantinaItems.id });
      if (updated.length === 0) {
        return { success: false, error: `Esgotado: ${item.name}. Ajuste a compra e tente novamente.` };
      }
    }

    const customerId = await upsertCustomer(buyer.data.name, buyer.data.email, buyer.data.whatsapp, input.customerCpf);

    let orderRows;
    try {
      orderRows = await db
        .insert(orders)
        .values({
          customerId,
          customerName: buyer.data.name,
          customerEmail: buyer.data.email,
          customerWhatsapp: buyer.data.whatsapp,
          status: "pending",
          totalCents,
          serviceFeeCents,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();
    } catch (e) {
      if (input.idempotencyKey && isUniqueViolation(e)) {
        const existing = await findCantinaOrderByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    }
    const [order] = orderRows;

    await db.insert(orderItems).values(
      resolved.map((i) => ({
        orderId: order.id,
        type: "cantina" as const,
        referenceId: i.itemId,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        metadata: { name: i.name, needsPrep: i.needsPrep },
      }))
    );

    // Vales — um por linha. Só entram na carteira quando o pedido estiver `paid`.
    await db.insert(cantinaVouchers).values(
      resolved.map((i) => ({
        orderId: order.id,
        customerId,
        itemId: i.itemId,
        itemName: i.name,
        unitPriceCents: i.unitPriceCents,
        needsPrep: i.needsPrep,
        qtyTotal: i.quantity,
      }))
    );

    const method = input.paymentMethod ?? "pix";
    const { gateway, slug: gatewaySlug } = await getGatewayForMethod(method);
    const { getSiteConfig } = await import("@/lib/config");
    const siteName = (await getSiteConfig()).siteName;

    const result = await gateway.createPayment({
      orderId: order.id,
      amountCents: totalCents,
      customerName: buyer.data.name,
      customerEmail: buyer.data.email,
      customerPhone: buyer.data.whatsapp,
      description: `${siteName} — Cantina · Compra #${order.id.slice(0, 8)}`,
      method,
      ...input.cardData,
      asaasCardData: input.asaasCardData,
      customerCpf: input.customerCpf,
    });

    const immediateStatus =
      method === "credit_card"
        ? result.cardStatus === "approved"
          ? "paid"
          : result.cardStatus === "rejected"
          ? "failed"
          : "pending"
        : "pending";

    const [payment] = await db
      .insert(payments)
      .values({
        orderId: order.id,
        gatewaySlug,
        gatewayPaymentId: result.gatewayPaymentId,
        status: "pending",
        amountCents: totalCents,
        pixQrCode: result.pixQrCode ?? null,
        pixQrCodeUrl: result.pixQrCodeUrl ?? null,
        pixExpiresAt: result.pixExpiresAt ?? null,
      })
      .returning();

    if (immediateStatus !== "pending") {
      await applyGatewayStatus(payment.id, order.id, immediateStatus);
    }

    return {
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      pixQrCode: result.pixQrCode,
      pixQrCodeUrl: result.pixQrCodeUrl,
      pixExpiresAt: result.pixExpiresAt?.toISOString(),
      cardStatus: result.cardStatus,
      cardStatusDetail: result.cardStatusDetail,
    };
  } catch (err) {
    console.error("createCantinaOrder error:", err);
    return { success: false, error: "Erro ao processar a compra. Tente novamente." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PÚBLICO — carteira "Minha Cantina" (por WhatsApp)
// ─────────────────────────────────────────────────────────────────────────────

export interface CantinaWalletVoucher {
  voucherId: string;
  itemName: string;
  unitPriceCents: number;
  needsPrep: boolean;
  qtyRemaining: number;
}
export interface CantinaWallet {
  found: boolean;
  customerId?: string;
  customerName?: string;
  vouchers?: CantinaWalletVoucher[];
}

/**
 * Carteira do cliente pelos dígitos do WhatsApp — vales de pedidos PAGOS com
 * saldo (qty_redeemed < qty_total). Sem auth (mesma premissa de /pedidos).
 */
export async function getCantinaWallet(whatsappDigits: string): Promise<CantinaWallet> {
  const digits = whatsappDigits.replace(/\D/g, "");
  if (digits.length < 10) return { found: false };
  const db = await getDb();

  const [customer] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.whatsapp, digits))
    .limit(1);
  if (!customer) return { found: false };

  const rows = await db
    .select({
      voucherId: cantinaVouchers.id,
      itemName: cantinaVouchers.itemName,
      unitPriceCents: cantinaVouchers.unitPriceCents,
      needsPrep: cantinaVouchers.needsPrep,
      qtyTotal: cantinaVouchers.qtyTotal,
      qtyRedeemed: cantinaVouchers.qtyRedeemed,
    })
    .from(cantinaVouchers)
    .innerJoin(orders, eq(cantinaVouchers.orderId, orders.id))
    .where(
      and(
        eq(cantinaVouchers.customerId, customer.id),
        eq(orders.status, "paid"),
        gt(cantinaVouchers.qtyTotal, cantinaVouchers.qtyRedeemed)
      )
    )
    .orderBy(asc(cantinaVouchers.itemName));

  return {
    found: true,
    customerId: customer.id,
    customerName: customer.name,
    vouchers: rows.map((r) => ({
      voucherId: r.voucherId,
      itemName: r.itemName,
      unitPriceCents: r.unitPriceCents,
      needsPrep: r.needsPrep,
      qtyRemaining: r.qtyTotal - r.qtyRedeemed,
    })),
  };
}
