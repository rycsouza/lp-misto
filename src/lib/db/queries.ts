import { getDb } from "./client";
import {
  games,
  news,
  players,
  boardMembers,
  legends,
  personalities,
  timelineEvents,
  sponsors,
  products,
  productVariants,
  orders,
  orderItems,
  payments,
  siteConfig,
} from "./schema";
import { eq, gt, asc, desc, and, sql, count, getTableColumns, inArray } from "drizzle-orm";
import type { UpsellOffer } from "./schema/upsell";

// No unstable_cache — page is force-dynamic and all content is admin-managed.
// Changes in the DB reflect immediately without waiting for cache expiry.

export async function getNextHomeGame() {
  const db = await getDb();
  const result = await db
    .select()
    .from(games)
    .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, new Date())))
    .orderBy(asc(games.date))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveHomeGames() {
  const db = await getDb();
  return db
    .select({
      id: games.id,
      competition: games.competition,
      round: games.round,
      date: games.date,
      opponent: games.opponent,
      opponentCrestUrl: games.opponentCrestUrl,
      venue: games.venue,
    })
    .from(games)
    .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, new Date())))
    .orderBy(asc(games.date));
}

export async function getNextGame() {
  const db = await getDb();
  const result = await db
    .select()
    .from(games)
    .where(and(eq(games.active, true), gt(games.date, new Date())))
    .orderBy(asc(games.date))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveNews() {
  const db = await getDb();
  return db
    .select()
    .from(news)
    .where(eq(news.active, true))
    .orderBy(desc(news.featured), desc(news.publishedAt));
}

export async function getActivePlayers(season: number) {
  const db = await getDb();
  return db
    .select()
    .from(players)
    .where(and(eq(players.active, true), eq(players.season, season)))
    .orderBy(asc(players.number));
}

export async function getActiveBoardMembers() {
  const db = await getDb();
  return db
    .select()
    .from(boardMembers)
    .where(eq(boardMembers.active, true))
    .orderBy(asc(boardMembers.order));
}

export async function getActiveLegends() {
  const db = await getDb();
  return db
    .select()
    .from(legends)
    .where(eq(legends.active, true))
    .orderBy(asc(legends.order));
}

export async function getActivePersonalities() {
  const db = await getDb();
  return db
    .select()
    .from(personalities)
    .where(eq(personalities.active, true))
    .orderBy(asc(personalities.order));
}

export async function getTimelineEvents() {
  const db = await getDb();
  return db.select().from(timelineEvents).orderBy(asc(timelineEvents.order));
}

export async function getActiveSponsors() {
  const db = await getDb();
  return db
    .select()
    .from(sponsors)
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.tier), asc(sponsors.order));
}

export async function getActiveProducts() {
  const db = await getDb();
  const productRows = await db
    .select({
      ...getTableColumns(products),
      variantCount: count(productVariants.id),
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(eq(productVariants.productId, products.id), eq(productVariants.active, true))
    )
    .where(eq(products.active, true))
    .groupBy(products.id)
    .orderBy(asc(products.order), asc(products.createdAt));

  if (productRows.length === 0) return [];

  const productIds = productRows.map((p) => p.id);
  const allVariants = await db
    .select({
      productId: productVariants.productId,
      color: productVariants.color,
      colorImageUrl: productVariants.colorImageUrl,
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.active, true)));

  // Unique colors per product (preserves insertion order)
  const colorMap = new Map<string, { color: string | null; colorImageUrl: string | null }[]>();
  const seenColorKeys = new Set<string>();
  for (const v of allVariants) {
    const key = `${v.productId}__${v.color ?? ""}`;
    if (seenColorKeys.has(key)) continue;
    seenColorKeys.add(key);
    const arr = colorMap.get(v.productId) ?? [];
    arr.push({ color: v.color, colorImageUrl: v.colorImageUrl });
    colorMap.set(v.productId, arr);
  }

  const now = new Date();
  return productRows.map((p) => {
    const onSale =
      p.salePriceCents !== null &&
      p.salePriceCents !== undefined &&
      (p.saleEndsAt === null || p.saleEndsAt === undefined || p.saleEndsAt > now);
    return {
      ...p,
      colorVariants: colorMap.get(p.id) ?? [],
      effectivePriceCents: onSale ? p.salePriceCents! : p.priceCents,
      onSale,
    };
  });
}

export async function getAllSiteConfig() {
  const db = await getDb();
  return db.select().from(siteConfig);
}

const SIZE_ORDER_MAP: Record<string, number> = { PP: 0, P: 1, M: 2, G: 3, GG: 4, XGG: 5, Único: 6 };

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);
  if (!product) return null;

  const rawVariants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true)));

  // Sort by color then size
  const variants = rawVariants.sort((a, b) => {
    const colorCmp = (a.color ?? "").localeCompare(b.color ?? "");
    if (colorCmp !== 0) return colorCmp;
    return (SIZE_ORDER_MAP[a.size] ?? 99) - (SIZE_ORDER_MAP[b.size] ?? 99);
  });

  // Unique colors in order they appear
  const seenColors = new Set<string>();
  const colors: { color: string; colorImageUrl: string | null }[] = [];
  for (const v of variants) {
    if (!v.color || seenColors.has(v.color)) continue;
    seenColors.add(v.color);
    colors.push({ color: v.color, colorImageUrl: v.colorImageUrl });
  }

  return { ...product, variants, colors };
}

export async function getApplicableUpsellOffer(input: {
  purchaseType: "ticket" | "product";
  totalCents: number;
  productIds?: string[];
}): Promise<(UpsellOffer & { discountedPriceCents: number }) | null> {
  try {
    const db = await getDb();
    const { upsellOffers } = await import("./schema");
    const rows = await db
      .select()
      .from(upsellOffers)
      .where(eq(upsellOffers.active, true))
      .orderBy(desc(upsellOffers.discountPct)); // best discount first

    for (const offer of rows) {
      // Check minimum order
      if (offer.minOrderCents > 0 && input.totalCents < offer.minOrderCents) continue;

      // Oferta de ingresso precisa de um jogo definido — sem jogo, não exibe
      // (evita cobrar/oferecer um ingresso que não pode ser materializado).
      if (offer.offerType === "ticket" && !offer.offerGameId) continue;

      // Check trigger type
      const matches =
        offer.triggerType === "any" ||
        (offer.triggerType === "ticket" && input.purchaseType === "ticket") ||
        (offer.triggerType === "product" && input.purchaseType === "product") ||
        (offer.triggerType === "specific_product" &&
          input.productIds?.includes(offer.triggerProductId ?? ""));

      if (!matches) continue;

      const qty = offer.offerQuantity ?? 1;
      const perUnitDiscounted = Math.round(offer.originalPriceCents * (1 - offer.discountPct / 100));
      const discountedPriceCents = perUnitDiscounted * qty;
      return { ...offer, discountedPriceCents };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getOrdersByWhatsapp(whatsappDigits: string) {
  const db = await getDb();
  const matchingOrders = await db
    .select()
    .from(orders)
    .where(
      sql`regexp_replace(${orders.customerWhatsapp}, '[^0-9]', '', 'g') = ${whatsappDigits}`
    )
    .orderBy(desc(orders.createdAt));

  if (matchingOrders.length === 0) return [];

  const orderIds = matchingOrders.map((o) => o.id);

  const [items, orderPayments] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(asc(orderItems.createdAt)),
    db
      .select()
      .from(payments)
      .where(inArray(payments.orderId, orderIds))
      .orderBy(desc(payments.createdAt)),
  ]);

  // Fetch game data for ticket items (via referenceId → games.id)
  const ticketGameIds = [
    ...new Set(
      items
        .filter((i) => i.type === "ticket" && i.referenceId)
        .map((i) => i.referenceId!)
    ),
  ];

  // Fetch product images: referenceId = productId, metadata.variantId = variantId
  const productItems = items.filter((i) => i.type === "product" && i.referenceId);
  const productIds = [...new Set(productItems.map((i) => i.referenceId!))];
  const variantIds = [
    ...new Set(
      productItems
        .map((i) => (i.metadata as Record<string, unknown> | null)?.variantId as string | undefined)
        .filter((v): v is string => !!v)
    ),
  ];

  const [ticketGames, productRows, variantRows] = await Promise.all([
    ticketGameIds.length > 0
      ? db
          .select({
            id: games.id,
            opponent: games.opponent,
            opponentCrestUrl: games.opponentCrestUrl,
            date: games.date,
            venue: games.venue,
            competition: games.competition,
          })
          .from(games)
          .where(inArray(games.id, ticketGameIds))
      : Promise.resolve([]),
    productIds.length > 0
      ? db
          .select({ id: products.id, imageUrl: products.imageUrl })
          .from(products)
          .where(inArray(products.id, productIds))
      : Promise.resolve([]),
    variantIds.length > 0
      ? db
          .select({ id: productVariants.id, colorImageUrl: productVariants.colorImageUrl })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : Promise.resolve([]),
  ]);

  const gameMap = Object.fromEntries(ticketGames.map((g) => [g.id, g]));
  const productImageMap = Object.fromEntries(productRows.map((p) => [p.id, p.imageUrl]));
  const variantImageMap = Object.fromEntries(variantRows.map((v) => [v.id, v.colorImageUrl]));

  return matchingOrders.map((order) => ({
    ...order,
    items: items.filter((i) => i.orderId === order.id).map((item) => {
      const meta = item.metadata as Record<string, unknown> | null;
      const variantId = meta?.variantId as string | undefined;
      const imageUrl =
        (variantId ? variantImageMap[variantId] : null) ??
        (item.referenceId ? productImageMap[item.referenceId] : null) ??
        null;

      return {
        ...item,
        imageUrl,
        game:
          item.type === "ticket" && item.referenceId
            ? (gameMap[item.referenceId] ?? null)
            : null,
      };
    }),
    payment: orderPayments.find((p) => p.orderId === order.id) ?? null,
  }));
}
