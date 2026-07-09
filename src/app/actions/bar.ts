"use server";

import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  barGameOfferings,
  barMenuItems,
  customers,
  orderItems,
  orders,
  payments,
  siteConfig,
} from "@/lib/db/schema";
import { getGatewayForMethod } from "@/lib/payment";
import { applyGatewayStatus } from "@/lib/payment/sync";
import { requireModule } from "@/lib/admin/auth-guard";
import { getBarConfig, computeServiceFeeCents } from "@/lib/bar/config";
import { validateCPF } from "@/lib/cpf";

// ── Tetos defensivos (o client nunca define preço; só identidade + quantidade)
const MAX_QTY_PER_LINE = 50;
const MAX_LINES = 40;

const buyerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
});

const barLineSchema = z.object({
  offeringId: z.string().uuid(),
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

export interface BarOrderResult {
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
// PÚBLICO — cardápio do jogo
// ─────────────────────────────────────────────────────────────────────────────

export interface BarCardapioItem {
  offeringId: string;
  menuItemId: string;
  name: string;
  description: string | null;
  category: "bebida" | "comida" | "outro";
  imageUrl: string | null;
  needsPrep: boolean;
  priceCents: number;
  soldOut: boolean;
}

/** Itens à venda no bar de um jogo (com preço efetivo e disponibilidade). */
export async function getBarCardapio(gameId: string): Promise<BarCardapioItem[]> {
  if (!z.string().uuid().safeParse(gameId).success) return [];
  const db = await getDb();
  const rows = await db
    .select({
      offeringId: barGameOfferings.id,
      menuItemId: barMenuItems.id,
      name: barMenuItems.name,
      description: barMenuItems.description,
      category: barMenuItems.category,
      imageUrl: barMenuItems.imageUrl,
      needsPrep: barMenuItems.needsPrep,
      basePriceCents: barMenuItems.priceCents,
      priceCentsOverride: barGameOfferings.priceCentsOverride,
      stockTotal: barGameOfferings.stockTotal,
      stockSold: barGameOfferings.stockSold,
      sortOrder: barMenuItems.sortOrder,
    })
    .from(barGameOfferings)
    .innerJoin(barMenuItems, eq(barGameOfferings.menuItemId, barMenuItems.id))
    .where(
      and(
        eq(barGameOfferings.gameId, gameId),
        eq(barGameOfferings.active, true),
        eq(barMenuItems.active, true)
      )
    )
    .orderBy(asc(barMenuItems.sortOrder), asc(barMenuItems.name));

  return rows.map((r) => ({
    offeringId: r.offeringId,
    menuItemId: r.menuItemId,
    name: r.name,
    description: r.description,
    category: r.category,
    imageUrl: r.imageUrl,
    needsPrep: r.needsPrep,
    priceCents: r.priceCentsOverride ?? r.basePriceCents,
    soldOut: r.stockTotal != null && r.stockSold >= r.stockTotal,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PÚBLICO — ficha (status ao vivo p/ o torcedor)
// ─────────────────────────────────────────────────────────────────────────────

export interface BarFichaPublic {
  found: boolean;
  status?: "pending" | "paid" | "cancelled" | "refunded";
  fulfillmentStatus?: "pending" | "ready" | "delivered";
  subtotalCents?: number;
  serviceFeeCents?: number;
  totalCents?: number;
  deliveredAt?: string;
  items?: { name: string; quantity: number; unitPriceCents: number; needsPrep: boolean }[];
}

/**
 * Estado público da ficha (keyed pelo orderId, que é o conteúdo do QR).
 * Sem auth — mesma premissa do /pedidos: o UUID do pedido é a credencial.
 */
export async function getBarFichaPublic(orderId: string): Promise<BarFichaPublic> {
  if (!z.string().uuid().safeParse(orderId).success) return { found: false };
  const db = await getDb();
  const [o] = await db
    .select({
      status: orders.status,
      fulfillmentStatus: orders.fulfillmentStatus,
      serviceFeeCents: orders.serviceFeeCents,
      totalCents: orders.totalCents,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o) return { found: false };

  const rows = await db
    .select({ quantity: orderItems.quantity, unitPriceCents: orderItems.unitPriceCents, metadata: orderItems.metadata })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "bar")));
  if (rows.length === 0) return { found: false }; // não é ficha de bar

  const items = rows.map((r) => {
    const m = (r.metadata as { name?: string; needsPrep?: boolean } | null) ?? {};
    return { name: m.name ?? "Item", quantity: r.quantity, unitPriceCents: r.unitPriceCents, needsPrep: m.needsPrep === true };
  });
  const subtotalCents = items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);

  return {
    found: true,
    status: o.status,
    fulfillmentStatus: o.fulfillmentStatus,
    subtotalCents,
    serviceFeeCents: o.serviceFeeCents ?? 0,
    totalCents: o.totalCents,
    deliveredAt: o.deliveredAt?.toISOString(),
    items,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PÚBLICO — checkout da ficha (reaproveita orders/payments)
// ─────────────────────────────────────────────────────────────────────────────

interface CreateBarOrderInput {
  gameId: string;
  buyer: { name: string; email: string; whatsapp: string };
  items: { offeringId: string; quantity: number }[];
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
async function findBarOrderByIdempotencyKey(key: string): Promise<BarOrderResult | null> {
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

export async function createBarOrder(input: CreateBarOrderInput): Promise<BarOrderResult> {
  const db = await getDb();
  if (input._hp) return { success: false, error: "Não foi possível processar o pedido." };

  const buyer = buyerSchema.safeParse(input.buyer);
  if (!buyer.success) return { success: false, error: buyer.error.issues[0]?.message ?? "Dados inválidos" };
  if (input.customerCpf && !validateCPF(input.customerCpf)) {
    return { success: false, error: "CPF inválido. Confira o número informado." };
  }
  if (!z.string().uuid().safeParse(input.gameId).success) {
    return { success: false, error: "Jogo inválido." };
  }

  // Idempotência antes de qualquer baixa de estoque.
  if (input.idempotencyKey) {
    const existing = await findBarOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  const linesParse = z.array(barLineSchema).min(1).max(MAX_LINES).safeParse(input.items);
  if (!linesParse.success) return { success: false, error: "Itens do pedido inválidos." };

  // Mescla quantidades por oferta (evita linhas duplicadas dobrarem estoque).
  const qtyByOffering = new Map<string, number>();
  for (const l of linesParse.data) {
    qtyByOffering.set(l.offeringId, (qtyByOffering.get(l.offeringId) ?? 0) + l.quantity);
  }
  const offeringIds = [...qtyByOffering.keys()];

  // Resolve preço/nome/preparo AUTORITATIVOS a partir da oferta do jogo.
  const offerRows = await db
    .select({
      offeringId: barGameOfferings.id,
      menuItemId: barMenuItems.id,
      name: barMenuItems.name,
      needsPrep: barMenuItems.needsPrep,
      basePriceCents: barMenuItems.priceCents,
      priceCentsOverride: barGameOfferings.priceCentsOverride,
      active: barGameOfferings.active,
      menuActive: barMenuItems.active,
    })
    .from(barGameOfferings)
    .innerJoin(barMenuItems, eq(barGameOfferings.menuItemId, barMenuItems.id))
    .where(and(eq(barGameOfferings.gameId, input.gameId), inArray(barGameOfferings.id, offeringIds)));
  const offerMap = new Map(offerRows.map((o) => [o.offeringId, o]));

  const resolved: {
    offeringId: string;
    menuItemId: string;
    name: string;
    needsPrep: boolean;
    quantity: number;
    unitPriceCents: number;
  }[] = [];
  for (const [offeringId, quantity] of qtyByOffering) {
    const o = offerMap.get(offeringId);
    if (!o || !o.active || !o.menuActive) {
      return { success: false, error: "Item indisponível. Atualize a página e tente novamente." };
    }
    resolved.push({
      offeringId,
      menuItemId: o.menuItemId,
      name: o.name,
      needsPrep: o.needsPrep,
      quantity,
      unitPriceCents: o.priceCentsOverride ?? o.basePriceCents,
    });
  }

  const subtotalCents = resolved.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);

  const cfg = await getBarConfig();
  if (cfg.minOrderCents > 0 && subtotalCents < cfg.minOrderCents) {
    return {
      success: false,
      error: `Pedido mínimo de R$ ${(cfg.minOrderCents / 100).toFixed(2).replace(".", ",")}.`,
    };
  }
  const serviceFeeCents = computeServiceFeeCents(subtotalCents, cfg);
  const totalCents = subtotalCents + serviceFeeCents;

  try {
    // Baixa de estoque ATÔMICA por oferta (check + decremento no mesmo UPDATE).
    // stock_total NULL = ilimitado. 0 linhas ⇒ esgotado.
    for (const item of resolved) {
      const updated = await db
        .update(barGameOfferings)
        .set({ stockSold: sql`${barGameOfferings.stockSold} + ${item.quantity}` })
        .where(
          and(
            eq(barGameOfferings.id, item.offeringId),
            eq(barGameOfferings.active, true),
            sql`(${barGameOfferings.stockTotal} IS NULL OR ${barGameOfferings.stockSold} + ${item.quantity} <= ${barGameOfferings.stockTotal})`
          )
        )
        .returning({ id: barGameOfferings.id });
      if (updated.length === 0) {
        return { success: false, error: `Esgotado: ${item.name}. Ajuste o pedido e tente novamente.` };
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
          gameId: input.gameId,
          status: "pending",
          totalCents,
          serviceFeeCents,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();
    } catch (e) {
      if (input.idempotencyKey && isUniqueViolation(e)) {
        const existing = await findBarOrderByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    }
    const [order] = orderRows;

    await db.insert(orderItems).values(
      resolved.map((i) => ({
        orderId: order.id,
        type: "bar" as const,
        referenceId: i.menuItemId,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        metadata: { name: i.name, needsPrep: i.needsPrep, offeringId: i.offeringId },
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
      description: `${siteName} — Bar · Ficha #${order.id.slice(0, 8)}`,
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
    console.error("createBarOrder error:", err);
    return { success: false, error: "Erro ao processar a ficha. Tente novamente." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERAÇÃO — preparo (cozinha) e balcão (entrega)
// ─────────────────────────────────────────────────────────────────────────────

export interface BarTabView {
  orderId: string;
  customerName: string;
  fulfillmentStatus: "pending" | "ready" | "delivered";
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
  items: { name: string; quantity: number; needsPrep: boolean }[];
}

async function loadTabItems(orderId: string) {
  const db = await getDb();
  const rows = await db
    .select({ quantity: orderItems.quantity, metadata: orderItems.metadata })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.type, "bar")));
  return rows.map((r) => {
    const m = (r.metadata as { name?: string; needsPrep?: boolean } | null) ?? {};
    return { name: m.name ?? "Item", quantity: r.quantity, needsPrep: m.needsPrep === true };
  });
}

/** Fila de preparo: fichas pagas e em preparo do jogo. */
export async function listBarPrepQueue(gameId: string): Promise<BarTabView[]> {
  await requireModule("bar_preparo");
  if (!z.string().uuid().safeParse(gameId).success) return [];
  const db = await getDb();
  const rows = await db
    .select({
      orderId: orders.id,
      customerName: orders.customerName,
      fulfillmentStatus: orders.fulfillmentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.gameId, gameId), eq(orders.status, "paid"), eq(orders.fulfillmentStatus, "pending")))
    .orderBy(asc(orders.createdAt));

  const out: BarTabView[] = [];
  for (const r of rows) {
    const items = await loadTabItems(r.orderId);
    if (items.length === 0) continue; // não é ficha de bar
    out.push({
      orderId: r.orderId,
      customerName: r.customerName,
      fulfillmentStatus: r.fulfillmentStatus,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      items,
    });
  }
  return out;
}

/** Cozinha marca a ficha inteira como pronta (pending → ready). */
export async function markBarTabReady(orderId: string): Promise<{ success: boolean; error?: string }> {
  await requireModule("bar_preparo");
  if (!z.string().uuid().safeParse(orderId).success) return { success: false, error: "Ficha inválida." };
  const db = await getDb();
  const updated = await db
    .update(orders)
    .set({ fulfillmentStatus: "ready" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), eq(orders.fulfillmentStatus, "pending")))
    .returning({ id: orders.id });
  if (updated.length === 0) return { success: false, error: "Ficha não está em preparo (ou já foi marcada)." };
  return { success: true };
}

/** Balcão consulta a ficha por ID (conteúdo do QR) para conferir antes de entregar. */
export async function getBarTabForDelivery(orderId: string): Promise<BarTabView | null> {
  await requireModule("bar_entrega");
  if (!z.string().uuid().safeParse(orderId).success) return null;
  const db = await getDb();
  const [o] = await db
    .select({
      orderId: orders.id,
      customerName: orders.customerName,
      fulfillmentStatus: orders.fulfillmentStatus,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!o) return null;
  const items = await loadTabItems(o.orderId);
  if (items.length === 0) return null; // não é ficha de bar
  return {
    orderId: o.orderId,
    customerName: o.customerName,
    fulfillmentStatus: o.fulfillmentStatus,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    items,
  };
}

/**
 * Entrega ATÔMICA (ready → delivered). Com N balcões, só o primeiro bip vence:
 * o WHERE exige `paid` + `ready`; 0 linhas ⇒ já entregue, não paga ou não pronta.
 */
export async function deliverBarTab(orderId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireModule("bar_entrega");
  if (!z.string().uuid().safeParse(orderId).success) return { success: false, error: "Ficha inválida." };
  const db = await getDb();
  const updated = await db
    .update(orders)
    .set({ fulfillmentStatus: "delivered", deliveredAt: new Date(), deliveredBy: session.name })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), eq(orders.fulfillmentStatus, "ready")))
    .returning({ id: orders.id });

  if (updated.length === 0) {
    // Diagnóstico amigável do porquê não deu.
    const [o] = await db
      .select({ status: orders.status, fulfillmentStatus: orders.fulfillmentStatus })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!o) return { success: false, error: "Ficha não encontrada." };
    if (o.fulfillmentStatus === "delivered") return { success: false, error: "Esta ficha já foi entregue." };
    if (o.status !== "paid") return { success: false, error: "Ficha não está paga." };
    return { success: false, error: "Ficha ainda não está pronta." };
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — cardápio, ofertas por jogo e configuração
// ─────────────────────────────────────────────────────────────────────────────

const menuItemSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  description: z.string().max(500).nullish(),
  category: z.enum(["bebida", "comida", "outro"]),
  priceCents: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  needsPrep: z.boolean(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function listBarMenuItems() {
  await requireModule("bar_cardapio");
  const db = await getDb();
  return db.select().from(barMenuItems).orderBy(asc(barMenuItems.sortOrder), asc(barMenuItems.name));
}

export async function createBarMenuItem(input: z.infer<typeof menuItemSchema>) {
  await requireModule("bar_cardapio");
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  const [row] = await db
    .insert(barMenuItems)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priceCents: parsed.data.priceCents,
      imageUrl: parsed.data.imageUrl || null,
      needsPrep: parsed.data.needsPrep,
      active: parsed.data.active ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning({ id: barMenuItems.id });
  return { success: true, id: row.id };
}

export async function updateBarMenuItem(id: string, input: z.infer<typeof menuItemSchema>) {
  await requireModule("bar_cardapio");
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Item inválido." };
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  await db
    .update(barMenuItems)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category,
      priceCents: parsed.data.priceCents,
      imageUrl: parsed.data.imageUrl || null,
      needsPrep: parsed.data.needsPrep,
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    })
    .where(eq(barMenuItems.id, id));
  return { success: true };
}

export async function deleteBarMenuItem(id: string) {
  await requireModule("bar_cardapio");
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Item inválido." };
  const db = await getDb();
  await db.delete(barMenuItems).where(eq(barMenuItems.id, id));
  return { success: true };
}

export async function listBarOfferings(gameId: string) {
  await requireModule("bar_cardapio");
  if (!z.string().uuid().safeParse(gameId).success) return [];
  const db = await getDb();
  return db
    .select({
      offeringId: barGameOfferings.id,
      menuItemId: barMenuItems.id,
      name: barMenuItems.name,
      basePriceCents: barMenuItems.priceCents,
      priceCentsOverride: barGameOfferings.priceCentsOverride,
      stockTotal: barGameOfferings.stockTotal,
      stockSold: barGameOfferings.stockSold,
      active: barGameOfferings.active,
    })
    .from(barGameOfferings)
    .innerJoin(barMenuItems, eq(barGameOfferings.menuItemId, barMenuItems.id))
    .where(eq(barGameOfferings.gameId, gameId))
    .orderBy(asc(barMenuItems.name));
}

const offeringSchema = z.object({
  gameId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  priceCentsOverride: z.number().int().nonnegative().nullish(),
  stockTotal: z.number().int().nonnegative().nullish(),
  active: z.boolean().optional(),
});

/** Cria/atualiza a oferta de um item para um jogo (upsert por (gameId, menuItemId)). */
export async function upsertBarOffering(input: z.infer<typeof offeringSchema>) {
  await requireModule("bar_cardapio");
  const parsed = offeringSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  await db
    .insert(barGameOfferings)
    .values({
      gameId: parsed.data.gameId,
      menuItemId: parsed.data.menuItemId,
      priceCentsOverride: parsed.data.priceCentsOverride ?? null,
      stockTotal: parsed.data.stockTotal ?? null,
      active: parsed.data.active ?? true,
    })
    .onConflictDoUpdate({
      target: [barGameOfferings.gameId, barGameOfferings.menuItemId],
      set: {
        priceCentsOverride: parsed.data.priceCentsOverride ?? null,
        stockTotal: parsed.data.stockTotal ?? null,
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        updatedAt: new Date(),
      },
    });
  return { success: true };
}

export async function removeBarOffering(offeringId: string) {
  await requireModule("bar_cardapio");
  if (!z.string().uuid().safeParse(offeringId).success) return { success: false, error: "Oferta inválida." };
  const db = await getDb();
  await db.delete(barGameOfferings).where(eq(barGameOfferings.id, offeringId));
  return { success: true };
}

const barConfigSchema = z.object({
  serviceFeeType: z.enum(["percent", "fixed"]),
  serviceFeeValue: z.number().int().nonnegative(),
  minOrderCents: z.number().int().nonnegative(),
});

/** Salva a config do bar (taxa + mínimo) no KV site_config. */
export async function saveBarConfig(input: z.infer<typeof barConfigSchema>) {
  await requireModule("bar_cardapio");
  const parsed = barConfigSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const db = await getDb();
  const entries: [string, string][] = [
    ["bar.serviceFeeType", parsed.data.serviceFeeType],
    ["bar.serviceFeeValue", String(parsed.data.serviceFeeValue)],
    ["bar.minOrderCents", String(parsed.data.minOrderCents)],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(siteConfig)
      .values({ key, value, type: "string", updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteConfig.key, set: { value, updatedAt: new Date() } });
  }
  return { success: true };
}

export async function getBarConfigForAdmin() {
  await requireModule("bar_cardapio");
  return getBarConfig();
}
