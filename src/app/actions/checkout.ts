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

interface TicketItem {
  gameId: string;
  typeCode: string;
  typeName: string;
  quantity: number;
  unitPriceCents: number;
}

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

interface UpsellInput {
  offerId: string;
  offerType: "ticket" | "product";
  gameId?: string;
  unitPriceCents: number;
  quantity?: number;
}

interface CreateOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  tickets: TicketItem[];
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  customerCpf?: string;
  upsell?: UpsellInput | null;
  couponCode?: string | null;
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

/**
 * Nome legível para o item de upsell de produto (usado no metadata.name, que
 * alimenta relatórios, "Meus Pedidos" e CSV). Prefere o nome do produto da
 * oferta; cai para o nome da oferta; por fim "Upsell". Nunca lança.
 */
async function resolveUpsellItemName(offerId: string): Promise<string> {
  try {
    const db = await getDb();
    const [offer] = await db
      .select({ name: upsellOffers.name, offerProductId: upsellOffers.offerProductId })
      .from(upsellOffers)
      .where(eq(upsellOffers.id, offerId))
      .limit(1);
    if (!offer) return "Upsell";
    if (offer.offerProductId) {
      const [p] = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, offer.offerProductId))
        .limit(1);
      if (p?.name) return p.name;
    }
    return offer.name ?? "Upsell";
  } catch {
    return "Upsell";
  }
}

/**
 * Resolve o jogo e o tipo de um upsell de INGRESSO a partir da oferta (fonte da
 * verdade — o jogo fica na própria oferta). Devolve null se a oferta não for de
 * ingresso ou não tiver jogo definido — nesse caso o upsell NÃO deve ser cobrado
 * (evita cobrar sem entregar ingresso, como acontecia no checkout da loja).
 */
async function resolveTicketUpsell(
  offerId: string
): Promise<{ gameId: string; typeCode: string; typeName: string } | null> {
  try {
    const db = await getDb();
    const [offer] = await db
      .select({ offerType: upsellOffers.offerType, offerGameId: upsellOffers.offerGameId, offerTicketType: upsellOffers.offerTicketType })
      .from(upsellOffers)
      .where(eq(upsellOffers.id, offerId))
      .limit(1);
    if (!offer || offer.offerType !== "ticket" || !offer.offerGameId) return null;

    const typeCode = offer.offerTicketType || "inteira";
    // Nome do tipo: prefere o tipo específico do jogo, depois o global, senão capitaliza o código.
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
    return { gameId: offer.offerGameId, typeCode, typeName };
  } catch {
    return null;
  }
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = await getDb();
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const headersList = await headers();
  const remoteIp =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    undefined;

  const ticketsCents = input.tickets.reduce(
    (acc, t) => acc + t.quantity * t.unitPriceCents,
    0
  );
  // Resolve o upsell de ingresso pela oferta (jogo/tipo). Se for ingresso sem
  // jogo configurado, o upsell é descartado (não cobra e não entrega).
  const ticketUpsell =
    input.upsell?.offerType === "ticket" ? await resolveTicketUpsell(input.upsell.offerId) : null;
  const effectiveUpsell =
    input.upsell && (input.upsell.offerType !== "ticket" || ticketUpsell) ? input.upsell : null;
  const upsellCents = (effectiveUpsell?.unitPriceCents ?? 0) * (effectiveUpsell?.quantity ?? 1);
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

  // Combo POR TIPO: cada tipo desconta conforme suas faixas (nº de jogos distintos)
  let bundleDiscountCents = 0;
  let bundleByType: Record<string, { games: number; pct: number; discountCents: number }> = {};
  {
    const { getSiteConfig } = await import("@/lib/config");
    const { getTicketTypesForGames } = await import("@/lib/tickets/resolve");
    const { computeCartCombo } = await import("@/lib/promotions/bundle");
    const config = await getSiteConfig();
    const gameIds = [...new Set(input.tickets.map((t) => t.gameId))];
    const gameRows = gameIds.length
      ? await db.select().from(games).where(inArray(games.id, gameIds))
      : [];
    const typesByGame = await getTicketTypesForGames(gameRows, config);
    // Faixas de combo por código de tipo (preferindo a definição não-vazia)
    const tiersByCode: Record<string, { games: number; pct: number }[]> = {};
    for (const gid of Object.keys(typesByGame)) {
      for (const tt of typesByGame[gid]) {
        if (!tiersByCode[tt.code] || tt.comboTiers.length > tiersByCode[tt.code].length) {
          tiersByCode[tt.code] = tt.comboTiers;
        }
      }
    }
    const lines = input.tickets.map((t) => ({
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

    const [order] = await db
      .insert(orders)
      .values({
        customerId,
        customerName: parsed.data.name,
        customerEmail: parsed.data.email,
        customerWhatsapp: parsed.data.whatsapp,
        totalCents,
        status: "pending",
        affiliateCode,
      })
      .returning();

    type ItemInsert = {
      orderId: string;
      type: "ticket" | "product" | "raffle";
      referenceId?: string | null;
      quantity: number;
      unitPriceCents: number;
      metadata?: Record<string, unknown> | null;
    };

    const itemsToInsert: ItemInsert[] = input.tickets.map((t) => ({
      orderId: order.id,
      type: "ticket" as const,
      referenceId: t.gameId,
      quantity: t.quantity,
      unitPriceCents: t.unitPriceCents,
      metadata: { ticketType: t.typeCode, typeName: t.typeName },
    }));

    if (effectiveUpsell) {
      const u = effectiveUpsell;
      if (u.offerType === "ticket" && ticketUpsell) {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: ticketUpsell.gameId,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { ticketType: ticketUpsell.typeCode, typeName: ticketUpsell.typeName, upsellOfferId: u.offerId, isUpsell: true },
        });
      } else if (u.offerType === "product") {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { name: await resolveUpsellItemName(u.offerId), upsellOfferId: u.offerId, isUpsell: true },
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
      description: `Ingresso Misto EC — Pedido #${order.id.slice(0, 8)}`,
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

interface ProductOrderItem {
  productId: string;
  variantId?: string | null;
  name: string;
  size?: string | null;
  quantity: number;
  unitPriceCents: number;
}

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
  shippingCostCents?: number;
  shippingServiceName?: string | null;
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  customerCpf?: string;
  upsell?: UpsellInput | null;
  couponCode?: string | null;
}

export async function createProductOrder(
  input: CreateProductOrderInput
): Promise<CreateOrderResult> {
  const db = await getDb();
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const headersList = await headers();
  const remoteIp =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    undefined;

  if (!input.items || input.items.length === 0) {
    return { success: false, error: "Nenhum item no carrinho" };
  }

  const itemsCents = input.items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);
  // Upsell de ingresso: jogo/tipo vêm da oferta. Sem jogo configurado → descarta
  // o upsell (não cobra), evitando cobrar sem gerar ingresso.
  const ticketUpsellProduct =
    input.upsell?.offerType === "ticket" ? await resolveTicketUpsell(input.upsell.offerId) : null;
  const effectiveUpsellProduct =
    input.upsell && (input.upsell.offerType !== "ticket" || ticketUpsellProduct) ? input.upsell : null;
  const upsellCentsProduct = (effectiveUpsellProduct?.unitPriceCents ?? 0) * (effectiveUpsellProduct?.quantity ?? 1);
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

  const shippingCostCentsProduct = input.shippingCostCents ?? 0;
  const totalCents =
    Math.max(0, subtotalCentsProduct - couponDiscountCentsProduct - memberDiscountCentsProduct - promotionDiscountCentsProduct) +
    shippingCostCentsProduct;

  try {
    // Atomic stock check + decrement
    for (const item of input.items) {
      if (item.variantId) {
        const [variant] = await db
          .select({ stock: productVariants.stock })
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .limit(1);

        if (!variant) return { success: false, error: `Variante não encontrada: ${item.name}` };
        if (variant.stock !== null && variant.stock < item.quantity) {
          return { success: false, error: `Estoque insuficiente para ${item.name} (${item.size})` };
        }
        if (variant.stock !== null) {
          await db
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
            .where(eq(productVariants.id, item.variantId));
        }
      } else {
        const [product] = await db
          .select({ stock: products.stock })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (product?.stock !== null && product?.stock !== undefined && product.stock < item.quantity) {
          return { success: false, error: `Estoque insuficiente para ${item.name}` };
        }
        if (product?.stock !== null && product?.stock !== undefined) {
          await db
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(eq(products.id, item.productId));
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

    const [order] = await db
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
        shippingCostCents: input.shippingCostCents ?? null,
        shippingServiceName: input.shippingServiceName ?? null,
        affiliateCode: affiliateCodeProduct,
      })
      .returning();

    type ItemInsert = {
      orderId: string;
      type: "ticket" | "product" | "raffle";
      referenceId?: string | null;
      quantity: number;
      unitPriceCents: number;
      metadata?: Record<string, unknown> | null;
    };

    const itemsToInsert: ItemInsert[] = input.items.map((i) => ({
      orderId: order.id,
      type: "product" as const,
      referenceId: i.productId,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      metadata: { name: i.name, size: i.size ?? null, variantId: i.variantId ?? null },
    }));

    if (effectiveUpsellProduct) {
      const u = effectiveUpsellProduct;
      if (u.offerType === "ticket" && ticketUpsellProduct) {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: ticketUpsellProduct.gameId,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { ticketType: ticketUpsellProduct.typeCode, typeName: ticketUpsellProduct.typeName, upsellOfferId: u.offerId, isUpsell: true },
        });
      } else if (u.offerType === "product") {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { name: await resolveUpsellItemName(u.offerId), upsellOfferId: u.offerId, isUpsell: true },
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

    const result = await gateway.createPayment({
      orderId: order.id,
      amountCents: totalCents,
      customerName: parsed.data.name,
      customerEmail: parsed.data.email,
      customerPhone: parsed.data.whatsapp,
      description: `Loja Misto EC — Pedido #${order.id.slice(0, 8)}`,
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
  cpf?: string;
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
      return { ...o, clubLogoUrl, tickets, pickupCode: pickupCode ?? o.pickupCode };
    })
  );
}

export async function lookupCustomer(whatsappDigits: string): Promise<LookupResult> {
  const db = await getDb();
  try {
    const rows = await db
      .select({ name: customers.name, email: customers.email, cpf: customers.cpf })
      .from(customers)
      .where(eq(customers.whatsapp, whatsappDigits))
      .limit(1);

    if (!rows[0]) return { found: false };

    const { name, email, cpf } = rows[0];
    const firstName = name.split(" ")[0];
    const maskedName = name.split(" ").length > 1 ? `${firstName} ***` : firstName;
    const [localPart, domain] = email.split("@");
    const visibleLocal = localPart.slice(0, Math.min(4, localPart.length));
    const maskedEmail = `${visibleLocal}***@${domain}`;
    const formattedCpf = cpf ? formatCpfDisplay(cpf) : undefined;

    return { found: true, name, email, cpf: formattedCpf, maskedName, maskedEmail };
  } catch (err) {
    console.error("lookupCustomer error:", err);
    return { found: false };
  }
}

function formatCpfDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
