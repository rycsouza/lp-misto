"use server";

import { z } from "zod";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  cantinaItems,
  cantinaVouchers,
  cantinaRedemptions,
  cantinaRedemptionItems,
  customers,
  orderItems,
  orders,
  payments,
  siteConfig,
} from "@/lib/db/schema";
import { getGatewayForMethod } from "@/lib/payment";
import { applyGatewayStatus } from "@/lib/payment/sync";
import { getCantinaConfig, computeCantinaServiceFeeCents } from "@/lib/cantina/config";
import { validateCPF } from "@/lib/cpf";
import { requireModule } from "@/lib/admin/auth-guard";
import { signWalletToken, verifyWalletToken } from "@/lib/cantina/wallet-token";

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
  /** Token opaco assinado (conteúdo do QR). Nunca expõe a PK do cliente. */
  walletToken?: string;
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
    walletToken: await signWalletToken(customer.id),
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

// ─────────────────────────────────────────────────────────────────────────────
// OPERAÇÃO — balcão (resgate) e preparo (cozinha)
// ─────────────────────────────────────────────────────────────────────────────

/** Balcão: lê a carteira pelo token do QR (assinado) para conferir saldo. */
export async function getCantinaWalletForCounter(walletToken: string): Promise<CantinaWallet> {
  await requireModule("cantina_entrega");
  const customerId = await verifyWalletToken((walletToken ?? "").trim());
  if (!customerId) return { found: false };
  const db = await getDb();

  const [customer] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(eq(customers.id, customerId))
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
    walletToken: await signWalletToken(customer.id),
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

const redeemSchema = z.object({
  walletToken: z.string().min(1),
  gameId: z.string().uuid().nullish(),
  items: z
    .array(z.object({ voucherId: z.string().uuid(), qty: z.number().int().positive().max(MAX_QTY_PER_LINE) }))
    .min(1)
    .max(MAX_LINES),
});

export interface RedeemResult {
  success: boolean;
  error?: string;
  redemptionId?: string;
  status?: "pending" | "ready" | "delivered";
}

/**
 * Resgate no balcão: consome N unidades de vales do cliente. Sem transação
 * (neon-http): cada vale tem UPDATE condicional atômico
 * (qty_redeemed + qty <= qty_total); se um falhar, compensa (estorna) os já
 * aplicados. Só vale de pedido PAGO e do próprio cliente. Se algum item exige
 * preparo, a retirada vai para a fila (pending); senão já sai como delivered.
 */
export async function redeemCantina(input: z.infer<typeof redeemSchema>): Promise<RedeemResult> {
  const session = await requireModule("cantina_entrega");
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos." };
  const customerId = await verifyWalletToken(parsed.data.walletToken.trim());
  if (!customerId) return { success: false, error: "Carteira inválida." };
  const db = await getDb();
  const { gameId } = parsed.data;

  const qtyByVoucher = new Map<string, number>();
  for (const it of parsed.data.items) {
    qtyByVoucher.set(it.voucherId, (qtyByVoucher.get(it.voucherId) ?? 0) + it.qty);
  }
  const voucherIds = [...qtyByVoucher.keys()];

  // Carrega vales válidos (do cliente, pedido pago) + snapshots + saldo atual.
  const rows = await db
    .select({
      id: cantinaVouchers.id,
      itemName: cantinaVouchers.itemName,
      needsPrep: cantinaVouchers.needsPrep,
      qtyTotal: cantinaVouchers.qtyTotal,
      qtyRedeemed: cantinaVouchers.qtyRedeemed,
    })
    .from(cantinaVouchers)
    .innerJoin(orders, eq(cantinaVouchers.orderId, orders.id))
    .where(
      and(
        inArray(cantinaVouchers.id, voucherIds),
        eq(cantinaVouchers.customerId, customerId),
        eq(orders.status, "paid")
      )
    );
  const voucherMap = new Map(rows.map((r) => [r.id, r]));

  // Todos os vales pedidos precisam existir/pertencer e ter saldo (checagem rápida).
  for (const [voucherId, qty] of qtyByVoucher) {
    const v = voucherMap.get(voucherId);
    if (!v) return { success: false, error: "Vale inválido para este cliente." };
    if (v.qtyTotal - v.qtyRedeemed < qty) {
      return { success: false, error: `Saldo insuficiente de ${v.itemName}.` };
    }
  }

  // Aplica com UPDATE condicional atômico; compensa se algum falhar.
  const applied: { voucherId: string; qty: number }[] = [];
  for (const [voucherId, qty] of qtyByVoucher) {
    const upd = await db
      .update(cantinaVouchers)
      .set({ qtyRedeemed: sql`${cantinaVouchers.qtyRedeemed} + ${qty}` })
      .where(
        and(
          eq(cantinaVouchers.id, voucherId),
          eq(cantinaVouchers.customerId, customerId),
          sql`${cantinaVouchers.qtyRedeemed} + ${qty} <= ${cantinaVouchers.qtyTotal}`
        )
      )
      .returning({ id: cantinaVouchers.id });
    if (upd.length === 0) {
      for (const a of applied) {
        await db
          .update(cantinaVouchers)
          .set({ qtyRedeemed: sql`${cantinaVouchers.qtyRedeemed} - ${a.qty}` })
          .where(eq(cantinaVouchers.id, a.voucherId));
      }
      return { success: false, error: "Saldo mudou durante a retirada. Atualize e tente de novo." };
    }
    applied.push({ voucherId, qty });
  }

  const anyPrep = [...qtyByVoucher.keys()].some((id) => voucherMap.get(id)?.needsPrep);
  const status: "pending" | "delivered" = anyPrep ? "pending" : "delivered";

  const [redemption] = await db
    .insert(cantinaRedemptions)
    .values({
      customerId,
      gameId: gameId ?? null,
      status,
      createdBy: session.name,
      ...(status === "delivered" ? { deliveredAt: new Date(), deliveredBy: session.name } : {}),
    })
    .returning({ id: cantinaRedemptions.id });

  await db.insert(cantinaRedemptionItems).values(
    [...qtyByVoucher].map(([voucherId, qty]) => {
      const v = voucherMap.get(voucherId)!;
      return { redemptionId: redemption.id, voucherId, itemName: v.itemName, needsPrep: v.needsPrep, qty };
    })
  );

  return { success: true, redemptionId: redemption.id, status };
}

export interface CantinaRedemptionView {
  redemptionId: string;
  customerName: string;
  status: "pending" | "ready" | "delivered";
  createdAt: string;
  items: { itemName: string; qty: number; needsPrep: boolean }[];
}

async function loadRedemptionItems(redemptionId: string) {
  const db = await getDb();
  const rows = await db
    .select({ itemName: cantinaRedemptionItems.itemName, qty: cantinaRedemptionItems.qty, needsPrep: cantinaRedemptionItems.needsPrep })
    .from(cantinaRedemptionItems)
    .where(eq(cantinaRedemptionItems.redemptionId, redemptionId));
  return rows;
}

/** Fila da cozinha: retiradas pendentes + prontas (aguardando entrega). */
export async function listCantinaPrepQueue(): Promise<CantinaRedemptionView[]> {
  await requireModule("cantina_preparo");
  const db = await getDb();
  const rows = await db
    .select({
      redemptionId: cantinaRedemptions.id,
      customerId: cantinaRedemptions.customerId,
      status: cantinaRedemptions.status,
      createdAt: cantinaRedemptions.createdAt,
    })
    .from(cantinaRedemptions)
    .where(inArray(cantinaRedemptions.status, ["pending", "ready"]))
    .orderBy(asc(cantinaRedemptions.createdAt));

  const custIds = [...new Set(rows.map((r) => r.customerId))];
  const custRows = custIds.length
    ? await db.select({ id: customers.id, name: customers.name }).from(customers).where(inArray(customers.id, custIds))
    : [];
  const custMap = new Map(custRows.map((c) => [c.id, c.name]));

  const out: CantinaRedemptionView[] = [];
  for (const r of rows) {
    const items = await loadRedemptionItems(r.redemptionId);
    out.push({
      redemptionId: r.redemptionId,
      customerName: custMap.get(r.customerId) ?? "—",
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      items,
    });
  }
  return out;
}

/** Cozinha marca a retirada como pronta (pending → ready). */
export async function markCantinaRedemptionReady(redemptionId: string): Promise<{ success: boolean; error?: string }> {
  await requireModule("cantina_preparo");
  if (!z.string().uuid().safeParse(redemptionId).success) return { success: false, error: "Retirada inválida." };
  const db = await getDb();
  const upd = await db
    .update(cantinaRedemptions)
    .set({ status: "ready" })
    .where(and(eq(cantinaRedemptions.id, redemptionId), eq(cantinaRedemptions.status, "pending")))
    .returning({ id: cantinaRedemptions.id });
  if (upd.length === 0) return { success: false, error: "Retirada não está pendente (ou já avançou)." };
  return { success: true };
}

/** Entrega ATÔMICA (ready → delivered). Com N balcões, só o primeiro vence. */
export async function deliverCantinaRedemption(redemptionId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireModule("cantina_entrega");
  if (!z.string().uuid().safeParse(redemptionId).success) return { success: false, error: "Retirada inválida." };
  const db = await getDb();
  const upd = await db
    .update(cantinaRedemptions)
    .set({ status: "delivered", deliveredAt: new Date(), deliveredBy: session.name })
    .where(and(eq(cantinaRedemptions.id, redemptionId), eq(cantinaRedemptions.status, "ready")))
    .returning({ id: cantinaRedemptions.id });
  if (upd.length === 0) return { success: false, error: "Retirada não está pronta (ou já entregue)." };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — catálogo (itens + cap global) e configuração
// ─────────────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  description: z.string().max(500).nullish(),
  category: z.enum(["bebida", "comida", "outro"]),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  needsPrep: z.boolean(),
  stockCap: z.number().int().nonnegative().nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function listCantinaItemsAdmin() {
  await requireModule("cantina_catalogo");
  const db = await getDb();
  return db.select().from(cantinaItems).orderBy(asc(cantinaItems.sortOrder), asc(cantinaItems.name));
}

export async function createCantinaItem(input: z.infer<typeof itemSchema>) {
  await requireModule("cantina_catalogo");
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  const [row] = await db
    .insert(cantinaItems)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priceCents: parsed.data.priceCents,
      imageUrl: parsed.data.imageUrl || null,
      needsPrep: parsed.data.needsPrep,
      stockCap: parsed.data.stockCap ?? null,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning({ id: cantinaItems.id });
  return { success: true, id: row.id };
}

export async function updateCantinaItem(id: string, input: z.infer<typeof itemSchema>) {
  await requireModule("cantina_catalogo");
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Item inválido." };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  await db
    .update(cantinaItems)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priceCents: parsed.data.priceCents,
      imageUrl: parsed.data.imageUrl || null,
      needsPrep: parsed.data.needsPrep,
      ...(parsed.data.stockCap !== undefined ? { stockCap: parsed.data.stockCap } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    })
    .where(eq(cantinaItems.id, id));
  return { success: true };
}

export async function deleteCantinaItem(id: string) {
  await requireModule("cantina_catalogo");
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Item inválido." };
  const db = await getDb();
  await db.delete(cantinaItems).where(eq(cantinaItems.id, id));
  return { success: true };
}

const cantinaConfigSchema = z.object({
  serviceFeeType: z.enum(["percent", "fixed"]),
  serviceFeeValue: z.number().int().nonnegative(),
  minOrderCents: z.number().int().nonnegative(),
});

export async function saveCantinaConfig(input: z.infer<typeof cantinaConfigSchema>) {
  await requireModule("cantina_catalogo");
  const parsed = cantinaConfigSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  const entries: [string, string][] = [
    ["cantina.serviceFeeType", parsed.data.serviceFeeType],
    ["cantina.serviceFeeValue", String(parsed.data.serviceFeeValue)],
    ["cantina.minOrderCents", String(parsed.data.minOrderCents)],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(siteConfig)
      .values({ key, value, type: "string", updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteConfig.key, set: { value, updatedAt: new Date() } });
  }
  return { success: true };
}

export async function getCantinaConfigForAdmin() {
  await requireModule("cantina_catalogo");
  return getCantinaConfig();
}
