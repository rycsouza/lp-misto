"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { orders, orderItems, payments, productVariants, products, customers } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getPaymentGateway, getActiveGatewayMeta } from "@/lib/payment";
import type { GatewayMeta } from "@/lib/payment";
import { sendOrderConfirmation } from "@/lib/email";
import type { validateCoupon } from "@/app/actions/coupon";
import { cookies } from "next/headers";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/utils";

const buyerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  _hp: z.string().optional(),
});

interface TicketItem {
  gameId: string;
  type: "inteira" | "meia";
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

async function upsertCustomer(name: string, email: string, whatsapp: string): Promise<string> {
  const normalized = whatsapp.replace(/\D/g, "");
  const [row] = await db
    .insert(customers)
    .values({ name, email, whatsapp: normalized })
    .onConflictDoUpdate({
      target: customers.whatsapp,
      set: { name, email, updatedAt: new Date() },
    })
    .returning({ id: customers.id });
  return row.id;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const ticketsCents = input.tickets.reduce(
    (acc, t) => acc + t.quantity * t.unitPriceCents,
    0
  );
  const upsellCents = (input.upsell?.unitPriceCents ?? 0) * (input.upsell?.quantity ?? 1);
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

  const totalCents = Math.max(0, subtotalCents - couponDiscountCents - memberDiscountCents - promotionDiscountCents);

  try {
    const customerId = await upsertCustomer(parsed.data.name, parsed.data.email, parsed.data.whatsapp);

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
      metadata: { ticketType: t.type },
    }));

    if (input.upsell) {
      const u = input.upsell;
      if (u.offerType === "ticket" && u.gameId) {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: u.gameId,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { ticketType: "inteira", upsellOfferId: u.offerId, isUpsell: true },
        });
      } else if (u.offerType === "product") {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { upsellOfferId: u.offerId, isUpsell: true },
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

    if (promotionDiscountCents > 0 && appliedPromotion) {
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

    const meta = await getActiveGatewayMeta();
    const gateway = await getPaymentGateway();
    const method = input.paymentMethod ?? "pix";

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
        gatewaySlug: meta.slug,
        gatewayPaymentId: result.gatewayPaymentId,
        status: immediateStatus,
        amountCents: totalCents,
        pixQrCode: result.pixQrCode ?? null,
        pixQrCodeUrl: result.pixQrCodeUrl ?? null,
        pixExpiresAt: result.pixExpiresAt ?? null,
        paidAt: immediateStatus === "paid" ? new Date() : undefined,
      })
      .returning();

    if (immediateStatus === "paid") {
      await db.update(orders).set({ status: "paid" }).where(eq(orders.id, order.id));
      sendOrderConfirmation(order.id).catch((err) =>
        console.error("[email] Falha ao enviar confirmação:", err)
      );
    } else if (immediateStatus === "failed") {
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
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

    // PIX expirado — cancela sem precisar consultar o gateway
    if (rows[0].pixExpiresAt && rows[0].pixExpiresAt < new Date()) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, paymentId));
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, rows[0].orderId));
      return "failed";
    }

    if (rows[0].gatewayPaymentId) {
      const gateway = await getPaymentGateway();
      const status = await gateway.getPaymentStatus(rows[0].gatewayPaymentId);
      if (status !== "pending") {
        await db
          .update(payments)
          .set({ status, paidAt: status === "paid" ? new Date() : undefined })
          .where(eq(payments.id, paymentId));
        if (status === "paid") {
          await db
            .update(orders)
            .set({ status: "paid" })
            .where(eq(orders.id, rows[0].orderId));
          sendOrderConfirmation(rows[0].orderId).catch((err) =>
            console.error("[email] Falha ao enviar confirmação:", err)
          );
          const { confirmAffiliateReferral } = await import("@/app/actions/affiliates");
          confirmAffiliateReferral(rows[0].orderId).catch((err) =>
            console.error("[affiliate] Falha ao confirmar indicação:", err)
          );
        }
      }
      return status;
    }

    return rows[0].status as "pending" | "paid" | "failed" | "refunded";
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

interface CreateProductOrderInput {
  buyer: { name: string; email: string; whatsapp: string };
  items: ProductOrderItem[];
  pickupInfo?: string;
  paymentMethod?: "pix" | "credit_card";
  cardData?: CardPaymentData;
  asaasCardData?: AsaasCardPaymentData;
  upsell?: UpsellInput | null;
  couponCode?: string | null;
}

export async function createProductOrder(
  input: CreateProductOrderInput
): Promise<CreateOrderResult> {
  const parsed = buyerSchema.safeParse(input.buyer);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, error: "Nenhum item no carrinho" };
  }

  const itemsCents = input.items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);
  const upsellCentsProduct = (input.upsell?.unitPriceCents ?? 0) * (input.upsell?.quantity ?? 1);
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

  const totalCents = Math.max(0, subtotalCentsProduct - couponDiscountCentsProduct - memberDiscountCentsProduct - promotionDiscountCentsProduct);

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

    const customerId = await upsertCustomer(parsed.data.name, parsed.data.email, parsed.data.whatsapp);

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

    if (input.upsell) {
      const u = input.upsell;
      if (u.offerType === "ticket" && u.gameId) {
        itemsToInsert.push({
          orderId: order.id,
          type: "ticket",
          referenceId: u.gameId,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { ticketType: "inteira", upsellOfferId: u.offerId, isUpsell: true },
        });
      } else if (u.offerType === "product") {
        itemsToInsert.push({
          orderId: order.id,
          type: "product",
          referenceId: null,
          quantity: u.quantity ?? 1,
          unitPriceCents: u.unitPriceCents,
          metadata: { upsellOfferId: u.offerId, isUpsell: true },
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

    const meta = await getActiveGatewayMeta();
    const gateway = await getPaymentGateway();
    const method = input.paymentMethod ?? "pix";

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
        gatewaySlug: meta.slug,
        gatewayPaymentId: result.gatewayPaymentId,
        status: immediateStatus,
        amountCents: totalCents,
        pixQrCode: result.pixQrCode ?? null,
        pixQrCodeUrl: result.pixQrCodeUrl ?? null,
        pixExpiresAt: result.pixExpiresAt ?? null,
        paidAt: immediateStatus === "paid" ? new Date() : undefined,
      })
      .returning();

    if (immediateStatus === "paid") {
      await db.update(orders).set({ status: "paid" }).where(eq(orders.id, order.id));
      sendOrderConfirmation(order.id).catch((err) =>
        console.error("[email] Falha ao enviar confirmação:", err)
      );
    } else if (immediateStatus === "failed") {
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
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

export async function saveCustomerData(name: string, email: string, whatsapp: string): Promise<void> {
  try {
    await upsertCustomer(name, email, whatsapp.replace(/\D/g, ""));
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

export async function fetchOrdersByWhatsapp(whatsappDigits: string) {
  const { getOrdersByWhatsapp } = await import("@/lib/db/queries");
  return getOrdersByWhatsapp(whatsappDigits);
}

export async function lookupCustomer(whatsappDigits: string): Promise<LookupResult> {
  try {
    const rows = await db
      .select({ name: customers.name, email: customers.email })
      .from(customers)
      .where(eq(customers.whatsapp, whatsappDigits))
      .limit(1);

    if (!rows[0]) return { found: false };

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
