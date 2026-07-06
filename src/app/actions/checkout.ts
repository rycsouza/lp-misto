"use server";

import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { orders, orderItems, payments, productVariants, products, customers, games, upsellOffers, ticketTypes } from "@/lib/db/schema";
import { eq, and, or, isNull, desc, sql, inArray } from "drizzle-orm";
import { getGatewayForMethod, getActiveGatewayMeta, getPaymentGatewayBySlug } from "@/lib/payment";
import type { GatewayMeta } from "@/lib/payment"; // usado em getGatewayInfo
import { applyGatewayStatus } from "@/lib/payment/sync";
import type { validateCoupon } from "@/app/actions/coupon";
import { cookies, headers } from "next/headers";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/utils";

const buyerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  _hp: z.string().optional(),
});

// ── P0: o client NUNCA define preço. Aqui só validamos IDENTIDADE + QUANTIDADE;
// todo preço é resolvido do banco no backend. Tetos defensivos evitam abuso.
const MAX_QTY_PER_LINE = 50;
const MAX_SHIPPING_CENTS = 100_000; // R$ 1.000 — teto defensivo para fallback de frete

const ticketLineSchema = z.object({
  gameId: z.string().uuid(),
  typeCode: z.string().min(1).max(60),
  quantity: z.number().int().positive().max(MAX_QTY_PER_LINE),
});

const productLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  quantity: z.number().int().positive().max(MAX_QTY_PER_LINE),
});

const upsellInputSchema = z.object({ offerId: z.string().uuid() });

// Item de ingresso enviado pelo client: apenas jogo + tipo + quantidade.
type TicketItem = z.infer<typeof ticketLineSchema>;

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

// O client só identifica a oferta; preço, quantidade, jogo e tipo vêm da oferta no DB.
type UpsellInput = z.infer<typeof upsellInputSchema>;

interface CreateOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  tickets: TicketItem[];
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  customerCpf?: string;
  upsell?: UpsellInput | null;
  couponCode?: string | null;
  /** Honeypot anti-bot: campo escondido — se vier preenchido, é bot. */
  _hp?: string;
  /** Chave de idempotência (gerada no client por tentativa de checkout). */
  idempotencyKey?: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  paymentId?: string;
  // PIX
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: string; // ISO string
  // Cartão
  cardStatus?: "approved" | "in_process" | "rejected";
  cardStatusDetail?: string;
  error?: string;
}

export async function getGatewayInfo(): Promise<GatewayMeta> {
  return getActiveGatewayMeta();
}

async function upsertCustomer(name: string, email: string, whatsapp: string, cpf?: string | null): Promise<string> {
  const db = await getDb();
  const normalized = whatsapp.replace(/\D/g, "");
  const cpfNormalized = cpf ? cpf.replace(/\D/g, "") : null;
  const [row] = await db
    .insert(customers)
    .values({ name, email, whatsapp: normalized, cpf: cpfNormalized })
    .onConflictDoUpdate({
      target: customers.whatsapp,
      set: {
        name,
        email,
        ...(cpfNormalized ? { cpf: cpfNormalized } : {}),
        updatedAt: new Date(),
      },
    })
    .returning({ id: customers.id });
  return row.id;
}

/** Preço efetivo de um produto no instante `now` (aplica promoção se vigente). */
function effectiveProductPriceCents(
  p: { priceCents: number; salePriceCents: number | null; saleEndsAt: Date | null },
  now: Date
): number {
  const onSale = p.salePriceCents != null && (p.saleEndsAt == null || p.saleEndsAt > now);
  return onSale ? p.salePriceCents! : p.priceCents;
}

interface ResolvedUpsell {
  offerId: string;
  offerType: "ticket" | "product";
  unitPriceCents: number;
  quantity: number;
  // ingresso
  gameId?: string;
  typeCode?: string;
  typeName?: string;
  // produto
  productName?: string;
}

/**
 * P0 — Resolve um upsell INTEIRAMENTE a partir da oferta no banco (fonte da
 * verdade): preço, quantidade, jogo, tipo e nome. O client manda só o `offerId`.
 *
 * Preço unitário = arredondamento de `originalPriceCents * (1 - discountPct/100)`
 * (idêntico a getApplicableUpsellOffer, garantindo que o total cobrado bate com
 * o exibido). Devolve null quando a oferta não existe/está inativa, ou quando é
 * um upsell de ingresso sem jogo configurado — nesses casos o upsell NÃO é
 * cobrado nem materializado. Nunca lança.
 */
async function resolveUpsell(offerId: string): Promise<ResolvedUpsell | null> {
  try {
    const db = await getDb();
    const [offer] = await db
      .select()
      .from(upsellOffers)
      .where(and(eq(upsellOffers.id, offerId), eq(upsellOffers.active, true)))
      .limit(1);
    if (!offer) return null;

    const quantity = offer.offerQuantity ?? 1;
    const unitPriceCents = Math.round(offer.originalPriceCents * (1 - offer.discountPct / 100));

    if (offer.offerType === "ticket") {
      if (!offer.offerGameId) return null; // sem jogo → não cobra e não entrega
      const typeCode = offer.offerTicketType || "inteira";
      let typeName = typeCode.charAt(0).toUpperCase() + typeCode.slice(1);
      try {
        const [tt] = await db
          .select({ name: ticketTypes.name })
          .from(ticketTypes)
          .where(
            and(
              eq(ticketTypes.code, typeCode),
              or(eq(ticketTypes.gameId, offer.offerGameId), isNull(ticketTypes.gameId))
            )
          )
          .orderBy(sql`${ticketTypes.gameId} nulls last`)
          .limit(1);
        if (tt?.name) typeName = tt.name;
      } catch {
        /* mantém o fallback */
      }
      return { offerId, offerType: "ticket", unitPriceCents, quantity, gameId: offer.offerGameId, typeCode, typeName };
    }

    // produto
    let productName = offer.name ?? "Upsell";
    if (offer.offerProductId) {
      const [p] = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, offer.offerProductId))
        .limit(1);
      if (p?.name) productName = p.name;
    }
    return { offerId, offerType: "product", unitPriceCents, quantity, productName };
  } catch {
    return null;
  }
}

/**
 * P0 — Frete autoritativo. Recota via Melhor Envio e só aceita o valor informado
 * pelo client se ele corresponder a uma cotação atual (o frete grátis elegível já
 * entra como opção de R$ 0). Valor divergente → bloqueia e pede recálculo (nunca
 * cobra a mais nem a menos em silêncio). Sem endereço → 0 (retirada). Cotação
 * vazia (sem item físico, origem não configurada ou transportadora fora) → usa o
 * valor informado com limites defensivos (≥ 0 e ≤ teto).
 */
async function resolveShippingCents(
  shippingAddress: { cep: string } | null,
  cartItems: { productId: string; quantity: number; unitPriceCents: number }[],
  subtotalCents: number,
  claimedCents: number
): Promise<{ cents: number } | { error: string }> {
  if (!shippingAddress?.cep) return { cents: 0 };
  const claimed = Math.round(claimedCents);
  try {
    const { getShippingOptions } = await import("./shipping");
    const options = await getShippingOptions(shippingAddress.cep, cartItems, subtotalCents);
    if (options.length === 0) {
      console.warn("[checkout] cotação de frete vazia — aplicando limites ao valor informado");
      return { cents: Math.max(0, Math.min(claimed, MAX_SHIPPING_CENTS)) };
    }
    const validPrices = new Set(options.map((o) => o.priceCents));
    if (validPrices.has(claimed)) return { cents: claimed };
    return { error: "O valor do frete mudou ou expirou. Volte uma etapa e recalcule o frete." };
  } catch (err) {
    console.error("resolveShippingCents error:", err);
    return { error: "Não foi possível confirmar o frete. Tente novamente." };
  }
}

/** Postgres unique_violation (índice de idempotência). */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

/**
 * Idempotência: se já existe um pedido com esta chave, devolve o MESMO resultado
 * (pedido/pagamento já criados) em vez de criar outro — evita pedido e cobrança
 * duplicados em duplo-clique/retry de rede. O client gera uma chave nova por
 * tentativa (e regenera após falha), então uma chave repetida = mesma submissão.
 */
async function findOrderByIdempotencyKey(key: string): Promise<CreateOrderResult | null> {
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
      // cardStatus só em estado terminal — em pending, o client usa o PIX/poll.
      cardStatus:
        payment?.status === "paid" ? "approved" : payment?.status === "failed" ? "rejected" : undefined,
    };
  } catch (err) {
    console.error("findOrderByIdempotencyKey error:", err);
    return null;
  }
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = await getDb();
  // Honeypot: campo escondido preenchido ⇒ bot. Rejeita sem revelar o motivo.
  if (input._hp) return { success: false, error: "Não foi possível processar o pedido." };
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Idempotência: se esta tentativa já virou pedido, devolve o mesmo resultado.
  if (input.idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  const headersList = await headers();
  const remoteIp =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    undefined;

  // P0 — valida itens (só identidade + quantidade). Todo preço vem do banco.
  const ticketParse = z.array(ticketLineSchema).min(1).safeParse(input.tickets);
  if (!ticketParse.success) {
    return { success: false, error: "Itens do pedido inválidos." };
  }
  const ticketLines = ticketParse.data;

  // Resolve preço/nome AUTORITATIVOS dos tipos de ingresso (uma vez; reusado no combo).
  const { getSiteConfig } = await import("@/lib/config");
  const { getTicketTypesForGames } = await import("@/lib/tickets/resolve");
  const config = await getSiteConfig();
  const gameIds = [...new Set(ticketLines.map((t) => t.gameId))];
  const gameRows = await db.select().from(games).where(inArray(games.id, gameIds));
  const typesByGame = await getTicketTypesForGames(gameRows, config);

  const resolvedTickets: {
    gameId: string;
    typeCode: string;
    typeName: string;
    quantity: number;
    unitPriceCents: number;
  }[] = [];
  for (const line of ticketLines) {
    const tt = typesByGame[line.gameId]?.find((t) => t.code === line.typeCode);
    if (!tt) {
      return { success: false, error: "Ingresso indisponível. Atualize a página e tente novamente." };
    }
    resolvedTickets.push({
      gameId: line.gameId,
      typeCode: tt.code,
      typeName: tt.name,
      quantity: line.quantity,
      unitPriceCents: tt.priceCents,
    });
  }
  const ticketsCents = resolvedTickets.reduce((acc, t) => acc + t.quantity * t.unitPriceCents, 0);

  // Upsell resolvido 100% pela oferta no banco (preço/qtd/jogo/tipo). Client manda só offerId.
  const upsellParse = input.upsell ? upsellInputSchema.safeParse(input.upsell) : null;
  const upsell = upsellParse?.success ? await resolveUpsell(upsellParse.data.offerId) : null;
  const upsellCents = upsell ? upsell.unitPriceCents * upsell.quantity : 0;
  const subtotalCents = ticketsCents + upsellCents;

  let couponDiscountCents = 0;
  let appliedCoupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (input.couponCode) {
    const { validateCoupon } = await import("@/app/actions/coupon");
    appliedCoupon = await validateCoupon(input.couponCode, subtotalCents, parsed.data.whatsapp.replace(/\D/g, ""));
    if (appliedCoupon.valid) couponDiscountCents = appliedCoupon.discountCents;
  }

  // Member auto-discount: apply ticket discount for active members
  let memberDiscountCents = 0;
  let memberPlanName: string | null = null;
  {
    const { getMemberDiscountForEmail } = await import("@/app/actions/membership");
    const { computeMemberDiscount } = await import("@/lib/membership/utils");
    const memberDiscount = await getMemberDiscountForEmail(parsed.data.email);
    if (memberDiscount?.ticketDiscountPct) {
      memberDiscountCents = computeMemberDiscount(ticketsCents, memberDiscount.ticketDiscountPct);
      memberPlanName = memberDiscount.planName;
    }
  }

  // Active promotion: auto-applied, no code required
  let promotionDiscountCents = 0;
  let appliedPromotion: { id: string; name: string } | null = null;
  {
    const { getActivePromotion } = await import("@/app/actions/promotions");
    const promo = await getActivePromotion("tickets", subtotalCents);
    if (promo) {
      promotionDiscountCents = promo.discountCents;
      appliedPromotion = { id: promo.id, name: promo.name };
    }
  }

  // Combo POR TIPO: cada tipo desconta conforme suas faixas (nº de jogos distintos).
  // Reusa `typesByGame` já resolvido acima — sem segunda ida ao banco.
  let bundleDiscountCents = 0;
  let bundleByType: Record<string, { games: number; pct: number; discountCents: number }> = {};
  {
    const { computeCartCombo } = await import("@/lib/promotions/bundle");
    // Faixas de combo por código de tipo (preferindo a definição não-vazia)
    const tiersByCode: Record<string, { games: number; pct: number }[]> = {};
    for (const gid of Object.keys(typesByGame)) {
      for (const tt of typesByGame[gid]) {
        if (!tiersByCode[tt.code] || tt.comboTiers.length > tiersByCode[tt.code].length) {
          tiersByCode[tt.code] = tt.comboTiers;
        }
      }
    }
    const lines = resolvedTickets.map((t) => ({
      gameId: t.gameId,
      code: t.typeCode,
      qty: t.quantity,
      priceCents: t.unitPriceCents,
      comboTiers: tiersByCode[t.typeCode] ?? [],
    }));
    const combo = computeCartCombo(lines);
    bundleDiscountCents = combo.totalCents;
    bundleByType = combo.byType;
  }

  // Entre os descontos automáticos de ingresso (promoção × combo) vale o maior
  const autoTicketDiscountCents = Math.max(promotionDiscountCents, bundleDiscountCents);
  const useBundle = bundleDiscountCents > 0 && bundleDiscountCents >= promotionDiscountCents;

  const totalCents = Math.max(0, subtotalCents - couponDiscountCents - memberDiscountCents - autoTicketDiscountCents);

  try {
    const customerId = await upsertCustomer(parsed.data.name, parsed.data.email, parsed.data.whatsapp, input.customerCpf);

    const cookieStore = await cookies();
    const cookieRef = cookieStore.get(AFFILIATE_COOKIE)?.value ?? null;
    // Coupon wins: if the applied coupon belongs to an affiliate, it takes precedence
    const affiliateCode = (appliedCoupon?.valid && appliedCoupon.affiliateCode)
      ? appliedCoupon.affiliateCode
      : cookieRef;

    let orderRows;
    try {
      orderRows = await db
        .insert(orders)
        .values({
          customerId,
          customerName: parsed.data.name,
          customerEmail: parsed.data.email,
          customerWhatsapp: parsed.data.whatsapp,
          totalCents,
          status: "pending",
          affiliateCode,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();
    } catch (e) {
      // Corrida: outra requisição com a mesma chave inseriu primeiro.
      if (input.idempotencyKey && isUniqueViolation(e)) {
        const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    }
    const [order] = orderRows;

    type ItemInsert = {
      orderId: string;
      type: "ticket" | "product" | "raffle";
      referenceId?: string | null;
      quantity: number;
      unitPriceCents: number;
      metadata?: Record<string, unknown> | null;
    };

    const itemsToInsert: ItemInsert[] = resolvedTickets.map((t) => ({
      orderId: order.id,
      type: "ticket" as const,
      referenceId: t.gameId,
      quantity: t.quantity,
      unitPriceCents: t.unitPriceCents,
      metadata: { ticketType: t.typeCode, typeName: t.typeName },
    }));

    if (upsell) {
      if (upsell.offerType === "ticket") {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: upsell.gameId,
          quantity: upsell.quantity,
          unitPriceCents: upsell.unitPriceCents,
          metadata: { ticketType: upsell.typeCode, typeName: upsell.typeName, upsellOfferId: upsell.offerId, isUpsell: true },
        });
      } else {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: upsell.quantity,
          unitPriceCents: upsell.unitPriceCents,
          metadata: { name: upsell.productName, upsellOfferId: upsell.offerId, isUpsell: true },
        });
      }
    }

    if (couponDiscountCents > 0 && appliedCoupon?.valid) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -couponDiscountCents,
        metadata: { isCouponDiscount: true, couponId: appliedCoupon.couponId, couponCode: appliedCoupon.code },
      });
    }

    if (memberDiscountCents > 0) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -memberDiscountCents,
        metadata: { isMemberDiscount: true, planName: memberPlanName },
      });
    }

    if (useBundle && bundleDiscountCents > 0) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -bundleDiscountCents,
        metadata: { isBundleDiscount: true, byType: bundleByType },
      });
    } else if (promotionDiscountCents > 0 && appliedPromotion) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -promotionDiscountCents,
        metadata: { isPromotion: true, promotionId: appliedPromotion.id, promotionName: appliedPromotion.name },
      });
    }

    await db.insert(orderItems).values(itemsToInsert);

    if (couponDiscountCents > 0 && appliedCoupon?.valid) {
      const { recordCouponUsage } = await import("@/app/actions/coupon");
      await recordCouponUsage(appliedCoupon.couponId, order.id, customerId, couponDiscountCents);
    }

    const method = input.paymentMethod ?? "pix";
    const { gateway, slug: gatewaySlug } = await getGatewayForMethod(method);

    const result = await gateway.createPayment({
      orderId: order.id,
      amountCents: totalCents,
      customerName: parsed.data.name,
      customerEmail: parsed.data.email,
      customerPhone: parsed.data.whatsapp,
      description: `${config.siteName} — Pedido #${order.id.slice(0, 8)}`,
      method,
      ...input.cardData,
      asaasCardData: input.asaasCardData,
      customerCpf: input.customerCpf,
      remoteIp,
    });

    // Determina status imediato para cartão
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

    // Cartão pode aprovar/recusar na hora. Roteamos pelo applyGatewayStatus para
    // que TODO o fluxo padrão de "pago" (status do pedido, e-mail de confirmação,
    // comissão de afiliado) seja idêntico ao do PIX/webhook/reconciliação.
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
    console.error("createOrder error:", err);
    return { success: false, error: "Erro ao processar pedido. Tente novamente." };
  }
}

export async function checkPaymentStatus(
  paymentId: string
): Promise<"pending" | "paid" | "failed" | "refunded"> {
  const db = await getDb();
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!rows[0]) return "pending";

    if (rows[0].status !== "pending") {
      return rows[0].status as "pending" | "paid" | "failed" | "refunded";
    }

    // O gateway é a fonte da verdade: consultamos ANTES de qualquer decisão
    // local. A cobrança PIX no ASAAS continua pagável muito além da nossa
    // janela de 30min, então só consideramos a expiração se o gateway ainda
    // não confirmou o pagamento.
    if (rows[0].gatewayPaymentId) {
      const gateway = await getPaymentGatewayBySlug(rows[0].gatewaySlug ?? "mock");
      const status = await gateway.getPaymentStatus(rows[0].gatewayPaymentId);
      if (status !== "pending") {
        await applyGatewayStatus(rows[0].id, rows[0].orderId, status);
        return status;
      }
    }

    // Gateway não confirmou — agora sim a expiração local marca como falho.
    if (rows[0].pixExpiresAt && rows[0].pixExpiresAt < new Date()) {
      await applyGatewayStatus(rows[0].id, rows[0].orderId, "failed");
      return "failed";
    }

    return "pending";
  } catch (err) {
    console.error("checkPaymentStatus error:", err);
    return "pending";
  }
}

// Item de produto enviado pelo client: apenas produto + variante + quantidade.
type ProductOrderItem = z.infer<typeof productLineSchema>;

interface ShippingAddressInput {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface CreateProductOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  items: ProductOrderItem[];
  pickupInfo?: string;
  shippingAddress?: ShippingAddressInput | null;
  /** Valor de frete informado pelo client — tratado apenas como reivindicação:
   *  o backend recota e só aceita se corresponder a uma cotação atual. */
  shippingCostCents?: number;
  shippingServiceName?: string | null;
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  customerCpf?: string;
  upsell?: UpsellInput | null;
  couponCode?: string | null;
  /** Honeypot anti-bot: campo escondido — se vier preenchido, é bot. */
  _hp?: string;
  /** Chave de idempotência (gerada no client por tentativa de checkout). */
  idempotencyKey?: string;
}

export async function createProductOrder(
  input: CreateProductOrderInput
): Promise<CreateOrderResult> {
  const db = await getDb();
  // Honeypot: campo escondido preenchido ⇒ bot. Rejeita sem revelar o motivo.
  if (input._hp) return { success: false, error: "Não foi possível processar o pedido." };
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Idempotência: se esta tentativa já virou pedido, devolve o mesmo resultado
  // (antes de qualquer baixa de estoque, evitando decrementos duplicados).
  if (input.idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
  }

  const headersList = await headers();
  const remoteIp =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    undefined;

  // P0 — valida itens (só identidade + quantidade). Todo preço vem do banco.
  const itemParse = z.array(productLineSchema).min(1).safeParse(input.items);
  if (!itemParse.success) {
    return { success: false, error: "Itens do pedido inválidos." };
  }
  const itemLines = itemParse.data;

  // Resolve preço efetivo, nome e tamanho AUTORITATIVOS de products/product_variants.
  const now = new Date();
  const productIds = [...new Set(itemLines.map((i) => i.productId))];
  const variantIds = [...new Set(itemLines.map((i) => i.variantId).filter((v): v is string => !!v))];
  const [productRows, variantRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        priceCents: products.priceCents,
        salePriceCents: products.salePriceCents,
        saleEndsAt: products.saleEndsAt,
        active: products.active,
      })
      .from(products)
      .where(inArray(products.id, productIds)),
    variantIds.length
      ? db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            size: productVariants.size,
            priceCents: productVariants.priceCents,
            active: productVariants.active,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : Promise.resolve([] as { id: string; productId: string; size: string; priceCents: number | null; active: boolean }[]),
  ]);
  const productMap = new Map(productRows.map((p) => [p.id, p]));
  const variantMap = new Map(variantRows.map((v) => [v.id, v]));

  const resolvedItems: {
    productId: string;
    variantId: string | null;
    name: string;
    size: string | null;
    quantity: number;
    unitPriceCents: number;
  }[] = [];
  for (const line of itemLines) {
    const product = productMap.get(line.productId);
    if (!product || !product.active) {
      return { success: false, error: "Produto indisponível. Atualize a página e tente novamente." };
    }
    let size: string | null = null;
    let variantId: string | null = null;
    // Preço da variante (se definido) é ABSOLUTO e sobrepõe o preço/promoção
    // do produto. Sem preço na variante, cai no preço efetivo do produto.
    let variantPriceCents: number | null = null;
    if (line.variantId) {
      const v = variantMap.get(line.variantId);
      if (!v || !v.active || v.productId !== line.productId) {
        return { success: false, error: "Variante indisponível. Atualize a página e tente novamente." };
      }
      size = v.size;
      variantId = v.id;
      variantPriceCents = v.priceCents;
    }
    resolvedItems.push({
      productId: product.id,
      variantId,
      name: product.name,
      size,
      quantity: line.quantity,
      unitPriceCents: variantPriceCents ?? effectiveProductPriceCents(product, now),
    });
  }
  const itemsCents = resolvedItems.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);

  // Upsell resolvido 100% pela oferta no banco. Client manda só offerId.
  const upsellParse = input.upsell ? upsellInputSchema.safeParse(input.upsell) : null;
  const upsell = upsellParse?.success ? await resolveUpsell(upsellParse.data.offerId) : null;
  const upsellCentsProduct = upsell ? upsell.unitPriceCents * upsell.quantity : 0;
  const subtotalCentsProduct = itemsCents + upsellCentsProduct;

  let couponDiscountCentsProduct = 0;
  let appliedCouponProduct: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (input.couponCode) {
    const { validateCoupon } = await import("@/app/actions/coupon");
    appliedCouponProduct = await validateCoupon(input.couponCode, subtotalCentsProduct, parsed.data.whatsapp.replace(/\D/g, ""));
    if (appliedCouponProduct.valid) couponDiscountCentsProduct = appliedCouponProduct.discountCents;
  }

  // Member auto-discount: apply product discount for active members
  let memberDiscountCentsProduct = 0;
  let memberPlanNameProduct: string | null = null;
  {
    const { getMemberDiscountForEmail } = await import("@/app/actions/membership");
    const { computeMemberDiscount } = await import("@/lib/membership/utils");
    const memberDiscount = await getMemberDiscountForEmail(parsed.data.email);
    if (memberDiscount?.productDiscountPct) {
      memberDiscountCentsProduct = computeMemberDiscount(itemsCents, memberDiscount.productDiscountPct);
      memberPlanNameProduct = memberDiscount.planName;
    }
  }

  // Active promotion: auto-applied, no code required
  let promotionDiscountCentsProduct = 0;
  let appliedPromotionProduct: { id: string; name: string } | null = null;
  {
    const { getActivePromotion } = await import("@/app/actions/promotions");
    const promo = await getActivePromotion("products", subtotalCentsProduct);
    if (promo) {
      promotionDiscountCentsProduct = promo.discountCents;
      appliedPromotionProduct = { id: promo.id, name: promo.name };
    }
  }

  // Frete autoritativo: recota e só aceita o valor que bater com uma cotação atual.
  const shippingRes = await resolveShippingCents(
    input.shippingAddress ?? null,
    resolvedItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    itemsCents,
    input.shippingCostCents ?? 0
  );
  if ("error" in shippingRes) {
    return { success: false, error: shippingRes.error };
  }
  const shippingCostCentsProduct = shippingRes.cents;
  const totalCents =
    Math.max(0, subtotalCentsProduct - couponDiscountCentsProduct - memberDiscountCentsProduct - promotionDiscountCentsProduct) +
    shippingCostCentsProduct;

  try {
    // Baixa de estoque ATÔMICA: a checagem e o decremento acontecem no MESMO
    // UPDATE condicional (`stock >= qty`), eliminando a corrida read-then-write
    // que permitia vender mais que o disponível com compras simultâneas.
    // `stock NULL` = ilimitado: o WHERE casa (NULL permanece NULL após o cálculo).
    // 0 linhas afetadas ⇒ estoque insuficiente (o item já foi validado como
    // existente/ativo na resolução acima). Observação: numa falha no meio de um
    // pedido multi-itens o decremento dos itens anteriores não é revertido
    // (neon-http é stateless, sem transação multi-statement) — isso só pode
    // sub-contar (nunca sobre-vender), então é conservador e aceitável.
    for (const item of resolvedItems) {
      if (item.variantId) {
        const updated = await db
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              sql`(${productVariants.stock} IS NULL OR ${productVariants.stock} >= ${item.quantity})`
            )
          )
          .returning({ id: productVariants.id });
        if (updated.length === 0) {
          return { success: false, error: `Estoque insuficiente para ${item.name}${item.size ? ` (${item.size})` : ""}` };
        }
      } else {
        const updated = await db
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(
            and(
              eq(products.id, item.productId),
              sql`(${products.stock} IS NULL OR ${products.stock} >= ${item.quantity})`
            )
          )
          .returning({ id: products.id });
        if (updated.length === 0) {
          return { success: false, error: `Estoque insuficiente para ${item.name}` };
        }
      }
    }

    const customerId = await upsertCustomer(parsed.data.name, parsed.data.email, parsed.data.whatsapp, input.customerCpf);

    const cookieStoreProduct = await cookies();
    const cookieRefProduct = cookieStoreProduct.get(AFFILIATE_COOKIE)?.value ?? null;
    // Coupon wins: if the applied coupon belongs to an affiliate, it takes precedence
    const affiliateCodeProduct = (appliedCouponProduct?.valid && appliedCouponProduct.affiliateCode)
      ? appliedCouponProduct.affiliateCode
      : cookieRefProduct;

    let orderRows;
    try {
      orderRows = await db
        .insert(orders)
        .values({
          customerId,
          customerName: parsed.data.name,
          customerEmail: parsed.data.email,
          customerWhatsapp: parsed.data.whatsapp,
          totalCents,
          status: "pending",
          pickupInfo: input.pickupInfo ?? null,
          shippingAddress: input.shippingAddress ?? null,
          shippingCostCents: input.shippingAddress ? shippingCostCentsProduct : null,
          shippingServiceName: input.shippingServiceName ?? null,
          affiliateCode: affiliateCodeProduct,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning();
    } catch (e) {
      // Corrida: outra requisição com a mesma chave inseriu primeiro.
      if (input.idempotencyKey && isUniqueViolation(e)) {
        const existing = await findOrderByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    }
    const [order] = orderRows;

    type ItemInsert = {
      orderId: string;
      type: "ticket" | "product" | "raffle";
      referenceId?: string | null;
      quantity: number;
      unitPriceCents: number;
      metadata?: Record<string, unknown> | null;
    };

    const itemsToInsert: ItemInsert[] = resolvedItems.map((i) => ({
      orderId: order.id,
      type: "product" as const,
      referenceId: i.productId,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      metadata: { name: i.name, size: i.size ?? null, variantId: i.variantId ?? null },
    }));

    if (upsell) {
      if (upsell.offerType === "ticket") {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: upsell.gameId,
          quantity: upsell.quantity,
          unitPriceCents: upsell.unitPriceCents,
          metadata: { ticketType: upsell.typeCode, typeName: upsell.typeName, upsellOfferId: upsell.offerId, isUpsell: true },
        });
      } else {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: upsell.quantity,
          unitPriceCents: upsell.unitPriceCents,
          metadata: { name: upsell.productName, upsellOfferId: upsell.offerId, isUpsell: true },
        });
      }
    }

    if (couponDiscountCentsProduct > 0 && appliedCouponProduct?.valid) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -couponDiscountCentsProduct,
        metadata: { isCouponDiscount: true, couponId: appliedCouponProduct.couponId, couponCode: appliedCouponProduct.code },
      });
    }

    if (memberDiscountCentsProduct > 0) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -memberDiscountCentsProduct,
        metadata: { isMemberDiscount: true, planName: memberPlanNameProduct },
      });
    }

    if (promotionDiscountCentsProduct > 0 && appliedPromotionProduct) {
      itemsToInsert.push({
        orderId: order.id,
        type: "product",
        referenceId: null,
        quantity: 1,
        unitPriceCents: -promotionDiscountCentsProduct,
        metadata: { isPromotion: true, promotionId: appliedPromotionProduct.id, promotionName: appliedPromotionProduct.name },
      });
    }

    await db.insert(orderItems).values(itemsToInsert);

    if (couponDiscountCentsProduct > 0 && appliedCouponProduct?.valid) {
      const { recordCouponUsage } = await import("@/app/actions/coupon");
      await recordCouponUsage(appliedCouponProduct.couponId, order.id, customerId, couponDiscountCentsProduct);
    }

    const method = input.paymentMethod ?? "pix";
    const { gateway, slug: gatewaySlug } = await getGatewayForMethod(method);

    const { getSiteConfig } = await import("@/lib/config");
    const siteName = (await getSiteConfig()).siteName;

    const result = await gateway.createPayment({
      orderId: order.id,
      amountCents: totalCents,
      customerName: parsed.data.name,
      customerEmail: parsed.data.email,
      customerPhone: parsed.data.whatsapp,
      description: `${siteName} — Pedido #${order.id.slice(0, 8)}`,
      method,
      ...input.cardData,
      asaasCardData: input.asaasCardData,
      customerCpf: input.customerCpf,
      remoteIp,
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

    // Cartão pode aprovar/recusar na hora. Roteamos pelo applyGatewayStatus para
    // que TODO o fluxo padrão de "pago" (status do pedido, e-mail de confirmação,
    // comissão de afiliado) seja idêntico ao do PIX/webhook/reconciliação.
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
    console.error("createProductOrder error:", err);
    return { success: false, error: "Erro ao processar pedido. Tente novamente." };
  }
}

export async function saveCustomerData(name: string, email: string, whatsapp: string, cpf?: string | null): Promise<void> {
  try {
    await upsertCustomer(name, email, whatsapp.replace(/\D/g, ""), cpf);
  } catch { /* best-effort — não bloqueia o checkout */ }
}

export async function fetchUpsellOffer(input: {
  purchaseType: "ticket" | "product";
  totalCents: number;
  productIds?: string[];
}) {
  const { getApplicableUpsellOffer } = await import("@/lib/db/queries");
  return getApplicableUpsellOffer(input);
}

interface LookupResult {
  found: boolean;
  name?: string;
  email?: string;
  maskedName?: string;
  maskedEmail?: string;
}

export async function getClubLogoUrl(): Promise<string> {
  const { getSiteConfig } = await import("@/lib/config");
  const config = await getSiteConfig();
  return config.clubLogoUrl;
}

export async function fetchOrdersByWhatsapp(whatsappDigits: string) {
  const { getOrdersByWhatsapp } = await import("@/lib/db/queries");
  const { getSiteConfig, DEFAULT_CLUB_LOGO_URL } = await import("@/lib/config");
  const [orders, config] = await Promise.all([
    getOrdersByWhatsapp(whatsappDigits),
    getSiteConfig(),
  ]);
  const clubLogoUrl = config.clubLogoUrl || DEFAULT_CLUB_LOGO_URL;
  const { ensureTicketsForOrder } = await import("@/lib/tickets/generate");
  const { signTicketToken } = await import("@/lib/tickets/token");
  const { ensurePickupCode } = await import("@/lib/pickup/code");
  // Anexa os ingressos individuais (1 QR por ingresso) com token JWT assinado
  return Promise.all(
    orders.map(async (o) => {
      const rawTickets = o.status === "paid" ? await ensureTicketsForOrder(o.id) : [];
      const tickets = await Promise.all(
        rawTickets.map(async (t) => ({
          ...t,
          qrToken: await signTicketToken(t.id, t.gameId, t.typeCode),
        }))
      );
      // Gera/recupera o código de retirada para pedidos de retirada pagos.
      const pickupCode = o.status === "paid" ? await ensurePickupCode(o.id) : null;
      return { ...o, clubLogoUrl, siteName: config.siteName, tickets, pickupCode: pickupCode ?? o.pickupCode };
    })
  );
}

export async function lookupCustomer(whatsappDigits: string): Promise<LookupResult> {
  const db = await getDb();
  try {
    const rows = await db
      .select({ name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.whatsapp, whatsappDigits))
      .limit(1);

    if (!rows[0]) return { found: false };

    // PRIVACIDADE: NÃO devolvemos CPF aqui — é o dado mais sensível (LGPD) e
    // este lookup é acionado só com o telefone (sem autenticação). O CPF, quando
    // necessário (cartão), é coletado na etapa de pagamento. Nome/e-mail seguem
    // para o auto-preenchimento do cliente recorrente. Obs.: o fechamento total
    // contra enumeração por telefone depende de rate limiting (item à parte).
    const { name, email } = rows[0];
    const firstName = name.split(" ")[0];
    const maskedName = name.split(" ").length > 1 ? `${firstName} ***` : firstName;
    const [localPart, domain] = email.split("@");
    const visibleLocal = localPart.slice(0, Math.min(4, localPart.length));
    const maskedEmail = `${visibleLocal}***@${domain}`;

    return { found: true, name, email, maskedName, maskedEmail };
  } catch (err) {
    console.error("lookupCustomer error:", err);
    return { found: false };
  }
}
