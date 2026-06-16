import { db } from "@/lib/db/client";
import { coupons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon } from "@/app/actions/admin-coupons";
import {
  getAdminUpsellOffers, createUpsellOffer, toggleUpsellOfferActive, deleteUpsellOffer,
  getAdminLeads,
  getAdminMembershipPlans, createMembershipPlan, updateMembershipPlan,
  toggleMembershipPlanActive, deleteMembershipPlan,
  getAdminMembers, updateMemberStatus,
} from "@/app/actions/admin-growth";
import {
  getAdminOrders, getAdminOrderDetail, cancelOrder, refundOrder,
  getAdminStats,
} from "@/app/actions/admin";
import {
  getAdminGames, createGame, updateGame, toggleGameActive,
} from "@/app/actions/admin";
import { getAdminConfigRows, updateConfigValues } from "@/app/actions/admin";
import { getAdminCustomers, getAdminCustomerById } from "@/app/actions/admin-customers";
import { getAdminProducts, toggleProductActive, createProduct, updateProduct, getAdminProductById, createVariant, deleteVariant } from "@/app/actions/admin-shop";
import {
  getAdminNews, toggleNewsActive, createNews, updateNews,
  getAdminPlayers, createPlayer, updatePlayer,
  getAdminSponsors, createSponsor, updateSponsor,
} from "@/app/actions/admin-content";
import {
  getAdminBoardMembers, createBoardMember, updateBoardMember,
  getAdminLegends, createLegend, updateLegend,
  getAdminPersonalities, createPersonality, updatePersonality,
} from "@/app/actions/admin-institutional";
import {
  getAdminPromotions, createPromotion, updatePromotion,
  togglePromotionActive, deletePromotion,
} from "@/app/actions/admin-promotions";
import {
  getAdminAffiliates, createAffiliate, updateAffiliate,
  deleteAffiliate, getAffiliateReferrals, markReferralsPaid,
} from "@/app/actions/admin-affiliates";
import { activateMemberById } from "@/app/actions/membership";
import { getSiteConfig } from "@/lib/config";

export interface ExecutorResult {
  success: boolean;
  message: string;
  data?: unknown;
}

type Params = Record<string, unknown>;

// ─── helpers ─────────────────────────────────────────────────────────────────
function brlToCents(brl: unknown): number {
  return Math.round(Number(brl ?? 0) * 100);
}

async function findCouponByCode(code: string) {
  const [row] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  return row ?? null;
}

async function resolveUpsellId(idOrName: string): Promise<{ id: string; name: string } | null> {
  // If it looks like a UUID, try direct lookup first
  if (/^[0-9a-f-]{36}$/i.test(idOrName)) {
    const rows = await getAdminUpsellOffers();
    const found = rows.find((r) => r.id === idOrName);
    if (found) return { id: found.id, name: found.name };
  }
  // Fall back to name match (case-insensitive, partial)
  const rows = await getAdminUpsellOffers();
  const needle = idOrName.toLowerCase();
  const found = rows.find((r) => r.name.toLowerCase().includes(needle));
  return found ? { id: found.id, name: found.name } : null;
}

// ─── executor map ─────────────────────────────────────────────────────────────
export const executors: Record<string, (params: Params) => Promise<ExecutorResult>> = {

  // CUPONS
  list_coupons: async () => {
    const rows = await getAdminCoupons();
    return { success: true, message: `${rows.length} cupom(ns) encontrado(s).`, data: rows };
  },

  create_coupon: async (p) => {
    const code = p.code ? String(p.code).toUpperCase() : generateCode();
    const appliesTo = String(p.appliesTo ?? "order") as "order" | "tickets" | "products";
    const result = await createCoupon({
      code,
      discountType: String(p.discountType) as "pct" | "fixed",
      discountValue: Number(p.discountValue),
      appliesTo,
      description: p.description ? String(p.description) : null,
      minOrderCents: p.minOrderValueBRL ? brlToCents(p.minOrderValueBRL) : 0,
      maxUsages: p.maxUsages != null ? Number(p.maxUsages) : null,
      maxUsagesPerCustomer: p.maxUsagesPerCustomer != null ? Number(p.maxUsagesPerCustomer) : null,
      expiresAt: p.expiresAt ? String(p.expiresAt) : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar cupom." };
    const linkPath = appliesTo === "products" ? `/checkout/produtos?cupom=${code}` : `/ingresso?cupom=${code}`;
    return {
      success: true,
      message: `Cupom ${code} criado com sucesso.`,
      data: { id: result.id, code, appliesTo, linkPath },
    };
  },

  update_coupon: async (p) => {
    const existing = await findCouponByCode(String(p.code));
    if (!existing) return { success: false, message: `Cupom "${p.code}" não encontrado.` };
    const result = await updateCoupon(existing.id, {
      code: p.newCode ? String(p.newCode).toUpperCase() : existing.code,
      discountType: (p.discountType ? String(p.discountType) : existing.discountType) as "pct" | "fixed",
      discountValue: p.discountValue != null ? Number(p.discountValue) : existing.discountValue,
      appliesTo: (p.appliesTo ? String(p.appliesTo) : existing.appliesTo) as "order" | "tickets" | "products",
      description: p.description !== undefined ? String(p.description) : existing.description ?? null,
      minOrderCents: p.minOrderValueBRL != null ? brlToCents(p.minOrderValueBRL) : existing.minOrderCents,
      maxUsages: p.maxUsages !== undefined ? Number(p.maxUsages) : existing.maxUsages ?? null,
      maxUsagesPerCustomer: p.maxUsagesPerCustomer !== undefined ? Number(p.maxUsagesPerCustomer) : existing.maxUsagesPerCustomer ?? null,
      expiresAt: p.expiresAt !== undefined ? String(p.expiresAt) : existing.expiresAt?.toISOString() ?? null,
      active: p.active !== undefined ? Boolean(p.active) : existing.active,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar." };
    return { success: true, message: `Cupom ${existing.code} atualizado.` };
  },

  toggle_coupon_active: async (p) => {
    const existing = await findCouponByCode(String(p.code));
    if (!existing) return { success: false, message: `Cupom "${p.code}" não encontrado.` };
    await db.update(coupons).set({ active: Boolean(p.active) }).where(eq(coupons.id, existing.id));
    return { success: true, message: `Cupom ${existing.code} ${p.active ? "ativado" : "desativado"}.` };
  },

  delete_coupon: async (p) => {
    const existing = await findCouponByCode(String(p.code));
    if (!existing) return { success: false, message: `Cupom "${p.code}" não encontrado.` };
    const result = await deleteCoupon(existing.id);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao excluir." };
    return { success: true, message: `Cupom ${existing.code} excluído.` };
  },

  // UPSELL
  list_upsell_offers: async () => {
    const rows = await getAdminUpsellOffers();
    return { success: true, message: `${rows.length} oferta(s) encontrada(s).`, data: rows };
  },

  create_upsell_offer: async (p) => {
    const name = String(p.name ?? p.title ?? "Oferta");
    const triggerType = (p.triggerType ? String(p.triggerType) : "any") as "any" | "ticket" | "product" | "specific_product";
    const offerType = String(p.offerType ?? "ticket") as "ticket" | "product";
    const offerTicketType = String(p.offerTicketType ?? "inteira") as "inteira" | "meia";

    // Auto-derive originalPriceCents if not provided by AI
    let originalPriceCents = p.originalPriceCents ? Number(p.originalPriceCents) : 0;
    if (!originalPriceCents) {
      if (offerType === "ticket") {
        const cfg = await getSiteConfig();
        originalPriceCents = offerTicketType === "meia"
          ? (cfg.ticketPriceMeiaCents as number)
          : (cfg.ticketPriceInteiraCents as number);
      } else if (offerType === "product" && p.offerProductId) {
        const { rows } = await getAdminProducts({ page: 1, limit: 100 });
        const prod = rows.find((r) => r.id === String(p.offerProductId));
        if (prod) originalPriceCents = prod.priceCents;
      }
    }

    const result = await createUpsellOffer({
      name,
      description: p.description ? String(p.description) : null,
      triggerType,
      triggerProductId: p.triggerProductId ? String(p.triggerProductId) : null,
      offerType,
      offerTicketType: offerType === "ticket" ? offerTicketType : null,
      offerQuantity: p.offerQuantity ? Number(p.offerQuantity) : 1,
      originalPriceCents,
      discountPct: Number(p.discountPct ?? 0),
      active: p.active !== false,
      minOrderCents: p.minOrderValueBRL ? brlToCents(p.minOrderValueBRL) : 0,
      // default timer: 5 min — only 0 if explicitly requested
      timerSeconds: p.timerMinutes != null ? Number(p.timerMinutes) * 60 : 300,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar oferta." };
    return { success: true, message: `Oferta "${name}" criada.`, data: { id: result.id, name, adminPath: `/admin/upsell/${result.id}` } };
  },

  toggle_upsell_offer_active: async (p) => {
    const offer = await resolveUpsellId(String(p.id));
    if (!offer) return { success: false, message: `Oferta "${p.id}" não encontrada.` };
    await toggleUpsellOfferActive(offer.id, Boolean(p.active));
    return { success: true, message: `Oferta "${offer.name}" ${p.active ? "ativada" : "desativada"}.` };
  },

  delete_upsell_offer: async (p) => {
    const offer = await resolveUpsellId(String(p.id));
    if (!offer) return { success: false, message: `Oferta "${p.id}" não encontrada. Use list_upsell_offers para ver as ofertas disponíveis.` };
    await deleteUpsellOffer(offer.id);
    return { success: true, message: `Oferta "${offer.name}" excluída com sucesso.` };
  },

  // PEDIDOS
  list_orders: async (p) => {
    const { rows, total } = await getAdminOrders({
      page: 1,
      status: p.status ? String(p.status) : undefined,
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Math.min(Number(p.limit), 50) : 10,
    });
    return { success: true, message: `${total} pedido(s) encontrado(s).`, data: rows };
  },

  get_order_detail: async (p) => {
    const detail = await getAdminOrderDetail(String(p.orderId));
    if (!detail) return { success: false, message: "Pedido não encontrado." };
    return { success: true, message: "Pedido encontrado.", data: detail };
  },

  cancel_order: async (p) => {
    const result = await cancelOrder(String(p.orderId));
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cancelar." };
    return { success: true, message: "Pedido cancelado." };
  },

  refund_order: async (p) => {
    const result = await refundOrder(String(p.orderId));
    if (!result.success) return { success: false, message: result.error ?? "Erro ao reembolsar." };
    return { success: true, message: "Pedido marcado como reembolsado." };
  },

  // JOGOS
  list_games: async (p) => {
    let { rows, total } = await getAdminGames({
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Number(p.limit) : 50,
    });
    if (total === 0 && p.search) {
      ({ rows, total } = await getAdminGames({ limit: 50 }));
    }
    return { success: true, message: `${total} jogo(s) encontrado(s).`, data: rows };
  },

  create_game: async (p) => {
    const result = await createGame({
      opponent: String(p.opponent),
      date: new Date(String(p.date)),
      venue: String(p.venue),
      competition: p.competition ? String(p.competition) : "",
      round: p.round ? String(p.round) : "",
      season: p.season ? Number(p.season) : new Date().getFullYear(),
      isHome: p.isHome !== false,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar jogo." };
    const opponent = String(p.opponent);
    return { success: true, message: `Jogo contra ${opponent} criado.`, data: { id: result.id, opponent, adminPath: `/admin/jogos/${result.id}` } };
  },

  update_game: async (p) => {
    const { id, ...rest } = p;
    const updates: Record<string, unknown> = {};
    if (rest.opponent) updates.opponent = String(rest.opponent);
    if (rest.date) updates.date = new Date(String(rest.date));
    if (rest.venue) updates.venue = String(rest.venue);
    if (rest.competition) updates.competition = String(rest.competition);
    if (rest.round) updates.round = String(rest.round);
    if (rest.active !== undefined) updates.active = Boolean(rest.active);
    const result = await updateGame(String(id), updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar jogo." };
    return { success: true, message: "Jogo atualizado." };
  },

  toggle_game_active: async (p) => {
    await toggleGameActive(String(p.id), Boolean(p.active));
    return { success: true, message: `Jogo ${p.active ? "ativado" : "desativado"} na bilheteria.` };
  },

  // CONFIGURAÇÕES
  get_site_config: async () => {
    const rows = await getAdminConfigRows();
    return { success: true, message: "Configurações carregadas.", data: rows };
  },

  update_site_config: async (p) => {
    const updates: Record<string, string> = {};
    if (p.ticketPriceInteiraBRL != null) updates["ticketPriceInteiraCents"] = String(brlToCents(p.ticketPriceInteiraBRL));
    if (p.ticketPriceMeiaBRL != null) updates["ticketPriceMeiaCents"] = String(brlToCents(p.ticketPriceMeiaBRL));
    if (Object.keys(updates).length === 0) return { success: false, message: "Nenhum campo fornecido para atualizar." };
    await updateConfigValues(updates);
    return { success: true, message: "Configurações atualizadas." };
  },

  // CLIENTES
  search_customers: async (p) => {
    const { rows, total } = await getAdminCustomers({
      search: String(p.search),
      page: 1,
    });
    const limited = rows.slice(0, p.limit ? Number(p.limit) : 10);
    return { success: true, message: `${total} cliente(s) encontrado(s).`, data: limited };
  },

  get_customer_detail: async (p) => {
    const detail = await getAdminCustomerById(String(p.customerId));
    if (!detail) return { success: false, message: "Cliente não encontrado." };
    return { success: true, message: "Cliente encontrado.", data: detail };
  },

  // PRODUTOS
  list_products: async (p) => {
    let { rows, total } = await getAdminProducts({
      page: 1,
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Number(p.limit) : 50,
    });
    // fallback: if search returned nothing, list all so the AI can identify the right product
    if (total === 0 && p.search) {
      ({ rows, total } = await getAdminProducts({ page: 1, limit: 50 }));
    }
    return { success: true, message: `${total} produto(s) encontrado(s).`, data: rows };
  },

  create_product: async (p) => {
    const name = String(p.name ?? "Produto");
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const result = await createProduct({
      name,
      slug,
      category: (String(p.category ?? "camisa_torcedor")) as "camisa_oficial" | "camisa_torcedor",
      priceCents: p.priceBRL ? Math.round(Number(p.priceBRL) * 100) : 0,
      imageUrl: p.imageUrl ? String(p.imageUrl) : null,
      active: p.active !== false,
      stock: p.stock ? Number(p.stock) : null,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar produto." };
    return { success: true, message: `Produto "${name}" criado.`, data: { id: result.id, name, adminPath: `/admin/loja/${result.id}` } };
  },

  update_product: async (p) => {
    // Resolve by ID or name
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const { rows } = await getAdminProducts({ page: 1, limit: 100 });
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Produto "${p.id}" não encontrado.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updateProduct>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.priceBRL != null) updates.priceCents = Math.round(Number(p.priceBRL) * 100);
    if (p.imageUrl !== undefined) updates.imageUrl = p.imageUrl ? String(p.imageUrl) : null;
    if (p.stock !== undefined) updates.stock = p.stock != null ? Number(p.stock) : null;
    if (p.active != null) updates.active = Boolean(p.active);
    if (p.comingSoon != null) updates.comingSoon = Boolean(p.comingSoon);
    if (p.category) updates.category = String(p.category) as "camisa_oficial" | "camisa_torcedor";
    if (p.salePriceBRL !== undefined) updates.salePriceCents = p.salePriceBRL != null ? Math.round(Number(p.salePriceBRL) * 100) : null;
    if (Object.keys(updates).length === 0) return { success: false, message: "Nenhum campo para atualizar foi informado." };
    const result = await updateProduct(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar produto." };
    return { success: true, message: `Produto atualizado.`, data: { adminPath: `/admin/loja/${targetId}` } };
  },

  toggle_product_active: async (p) => {
    await toggleProductActive(String(p.id), Boolean(p.active));
    return { success: true, message: `Produto ${p.active ? "ativado" : "desativado"}.` };
  },

  list_product_variants: async (p) => {
    let targetId = String(p.productId);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const { rows } = await getAdminProducts({ page: 1, limit: 100 });
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Produto "${p.productId}" não encontrado.` };
      targetId = found.id;
    }
    const product = await getAdminProductById(targetId);
    if (!product) return { success: false, message: "Produto não encontrado." };
    return {
      success: true,
      message: `${product.variants.length} variante(s) de "${product.name}".`,
      data: product.variants,
    };
  },

  create_variants_bulk: async (p) => {
    const ALL_SIZES = ["PP", "P", "M", "G", "GG", "XGG", "Único"];
    let targetId = String(p.productId);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const { rows } = await getAdminProducts({ page: 1, limit: 100 });
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Produto "${p.productId}" não encontrado.` };
      targetId = found.id;
    }
    const colors = p.colors as Array<{ color: string; colorImageUrl?: string }>;
    const sizes: string[] = Array.isArray(p.sizes) && (p.sizes as string[]).length > 0
      ? p.sizes as string[]
      : ALL_SIZES;
    const stock = p.stock != null ? Number(p.stock) : null;
    const active = p.active !== false;

    const created: string[] = [];
    const errors: string[] = [];

    for (const colorEntry of colors) {
      for (const size of sizes) {
        const result = await createVariant({
          productId: targetId,
          color: colorEntry.color,
          colorImageUrl: colorEntry.colorImageUrl ?? null,
          size,
          stock,
          active,
        });
        if (result.success) {
          created.push(`${colorEntry.color} / ${size}`);
        } else {
          errors.push(`${colorEntry.color} / ${size}: ${result.error ?? "erro"}`);
        }
      }
    }

    const lines = [`${created.length} variante(s) criada(s).`];
    if (errors.length) lines.push(`Falhas (${errors.length}): ${errors.join(", ")}`);
    return {
      success: created.length > 0,
      message: lines.join(" "),
      data: { created, errors },
    };
  },

  delete_variant: async (p) => {
    await deleteVariant(String(p.variantId));
    return { success: true, message: "Variante excluída." };
  },

  // DASHBOARD
  get_dashboard_stats: async () => {
    const stats = await getAdminStats();
    return {
      success: true,
      message: "Estatísticas carregadas.",
      data: {
        receitaHoje: stats.totalRevenueTodayCents / 100,
        receitaMes: stats.totalRevenueMonthCents / 100,
        pedidosHoje: stats.ordersToday,
        pedidosPendentes: stats.ordersPending,
        pedidosPagos: stats.ordersPaid,
        pedidosCancelados: stats.ordersCancelled,
        grafico7dias: stats.revenueChartData,
      },
    };
  },

  // LEADS
  list_leads: async (p) => {
    const { rows, total } = await getAdminLeads({
      page: 1,
      search: p.search ? String(p.search) : undefined,
      source: p.source ? String(p.source) : undefined,
      limit: p.limit ? Number(p.limit) : 20,
    });
    return { success: true, message: `${total} lead(s) encontrado(s).`, data: rows };
  },

  // NOTÍCIAS
  list_news: async (p) => {
    let { rows, total } = await getAdminNews({
      page: 1,
      search: p.search ? String(p.search) : undefined,
    });
    if (total === 0 && p.search) {
      ({ rows, total } = await getAdminNews({ page: 1 }));
    }
    return { success: true, message: `${total} notícia(s) encontrada(s).`, data: rows };
  },

  toggle_news_active: async (p) => {
    const idOrTitle = String(p.id);
    let targetId = idOrTitle;
    if (!/^[0-9a-f-]{36}$/i.test(idOrTitle)) {
      const { rows } = await getAdminNews({ page: 1 });
      const found = rows.find((r) => r.title.toLowerCase().includes(idOrTitle.toLowerCase()));
      if (!found) return { success: false, message: `Notícia "${idOrTitle}" não encontrada.` };
      targetId = found.id;
    }
    await toggleNewsActive(targetId, Boolean(p.active));
    return { success: true, message: `Notícia ${p.active ? "publicada" : "despublicada"}.` };
  },

  create_news: async (p) => {
    const result = await createNews({
      title: String(p.title),
      summary: String(p.summary),
      category: String(p.category ?? "futebol_profissional"),
      imageUrl: p.imageUrl ? String(p.imageUrl) : null,
      featured: Boolean(p.featured ?? false),
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar notícia." };
    return { success: true, message: `Notícia "${p.title}" criada.`, data: { adminPath: `/admin/noticias/${result.id}` } };
  },

  update_news: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const { rows } = await getAdminNews({ page: 1 });
      const found = rows.find((r) => r.title.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Notícia "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updateNews>[1] = {};
    if (p.title) updates.title = String(p.title);
    if (p.summary) updates.summary = String(p.summary);
    if (p.imageUrl) updates.imageUrl = String(p.imageUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    if (p.featured != null) updates.featured = Boolean(p.featured);
    const result = await updateNews(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar notícia." };
    return { success: true, message: "Notícia atualizada.", data: { adminPath: `/admin/noticias/${targetId}` } };
  },

  // ELENCO
  list_players: async (p) => {
    const { rows, total } = await getAdminPlayers({
      season: p.season ? Number(p.season) : undefined,
      position: p.position ? String(p.position) : undefined,
    });
    return { success: true, message: `${total} jogador(es) encontrado(s).`, data: rows };
  },

  create_player: async (p) => {
    const result = await createPlayer({
      name: String(p.name),
      number: p.number ? Number(p.number) : null,
      position: String(p.position ?? "meia") as "goleiro" | "zagueiro" | "lateral" | "volante" | "meia" | "atacante",
      photoUrl: p.photoUrl ? String(p.photoUrl) : null,
      season: p.season ? Number(p.season) : new Date().getFullYear(),
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cadastrar jogador." };
    return { success: true, message: `Jogador "${p.name}" cadastrado.`, data: { adminPath: `/admin/elenco/${result.id}` } };
  },

  update_player: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const { rows } = await getAdminPlayers({});
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Jogador "${p.id}" não encontrado.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updatePlayer>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.number != null) updates.number = Number(p.number);
    if (p.position) updates.position = String(p.position) as "goleiro" | "zagueiro" | "lateral" | "volante" | "meia" | "atacante";
    if (p.photoUrl) updates.photoUrl = String(p.photoUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    const result = await updatePlayer(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar jogador." };
    return { success: true, message: "Jogador atualizado.", data: { adminPath: `/admin/elenco/${targetId}` } };
  },

  // PATROCINADORES
  list_sponsors: async () => {
    const rows = await getAdminSponsors();
    return { success: true, message: `${rows.length} patrocinador(es).`, data: rows };
  },

  create_sponsor: async (p) => {
    if (!p.logoUrl) return { success: false, message: "logoUrl é obrigatório. Peça ao usuário que anexe o logo no chat." };
    const result = await createSponsor({
      name: String(p.name),
      logoUrl: String(p.logoUrl),
      logoTone: String(p.logoTone ?? "light") as "light" | "dark",
      tier: String(p.tier ?? "bronze") as "diamante" | "ouro" | "prata" | "bronze",
      instagramUrl: p.instagramUrl ? String(p.instagramUrl) : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cadastrar patrocinador." };
    return { success: true, message: `Patrocinador "${p.name}" cadastrado.`, data: { adminPath: `/admin/patrocinadores/${result.id}` } };
  },

  update_sponsor: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminSponsors();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Patrocinador "${p.id}" não encontrado.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updateSponsor>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.logoUrl) updates.logoUrl = String(p.logoUrl);
    if (p.logoTone) updates.logoTone = String(p.logoTone) as "light" | "dark";
    if (p.tier) updates.tier = String(p.tier) as "diamante" | "ouro" | "prata" | "bronze";
    if (p.instagramUrl != null) updates.instagramUrl = String(p.instagramUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    const result = await updateSponsor(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar patrocinador." };
    return { success: true, message: "Patrocinador atualizado.", data: { adminPath: `/admin/patrocinadores/${targetId}` } };
  },

  // DIRETORIA
  list_board_members: async () => {
    const rows = await getAdminBoardMembers();
    return { success: true, message: `${rows.length} membro(s) da diretoria.`, data: rows };
  },

  create_board_member: async (p) => {
    const result = await createBoardMember({
      name: String(p.name),
      role: String(p.role),
      profession: p.profession ? String(p.profession) : null,
      photoUrl: p.photoUrl ? String(p.photoUrl) : null,
      group: String(p.group ?? "executive") as "executive" | "fiscal",
      fiscalType: p.fiscalType ? String(p.fiscalType) as "titular" | "suplente" : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cadastrar membro." };
    return { success: true, message: `${p.name} cadastrado na diretoria.`, data: { adminPath: `/admin/diretoria/${result.id}` } };
  },

  update_board_member: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminBoardMembers();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Membro "${p.id}" não encontrado.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updateBoardMember>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.role) updates.role = String(p.role);
    if (p.profession != null) updates.profession = String(p.profession);
    if (p.photoUrl) updates.photoUrl = String(p.photoUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    const result = await updateBoardMember(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar membro." };
    return { success: true, message: "Membro da diretoria atualizado.", data: { adminPath: `/admin/diretoria/${targetId}` } };
  },

  // LENDAS
  list_legends: async () => {
    const rows = await getAdminLegends();
    return { success: true, message: `${rows.length} lenda(s).`, data: rows };
  },

  create_legend: async (p) => {
    const result = await createLegend({
      name: String(p.name),
      photoUrl: p.photoUrl ? String(p.photoUrl) : null,
      position: p.position ? String(p.position) : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cadastrar lenda." };
    return { success: true, message: `Lenda "${p.name}" cadastrada.`, data: { adminPath: "/admin/lendas" } };
  },

  update_legend: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminLegends();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Lenda "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updateLegend>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.position != null) updates.position = String(p.position);
    if (p.photoUrl) updates.photoUrl = String(p.photoUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    const result = await updateLegend(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar lenda." };
    return { success: true, message: "Lenda atualizada.", data: { adminPath: `/admin/lendas/${targetId}` } };
  },

  // PERSONALIDADES
  list_personalities: async (p) => {
    const rows = await getAdminPersonalities(
      p.category ? String(p.category) : undefined
    );
    return { success: true, message: `${rows.length} personalidade(s).`, data: rows };
  },

  create_personality: async (p) => {
    const result = await createPersonality({
      name: String(p.name),
      role: p.role ? String(p.role) : null,
      category: String(p.category ?? "voluntarios") as "medicos" | "dirigentes" | "tecnicos" | "voluntarios",
      photoUrl: p.photoUrl ? String(p.photoUrl) : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao cadastrar personalidade." };
    return { success: true, message: `Personalidade "${p.name}" cadastrada.`, data: { adminPath: "/admin/personalidades" } };
  },

  update_personality: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminPersonalities();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Personalidade "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    const updates: Parameters<typeof updatePersonality>[1] = {};
    if (p.name) updates.name = String(p.name);
    if (p.role != null) updates.role = String(p.role);
    if (p.category) updates.category = String(p.category) as "medicos" | "dirigentes" | "tecnicos" | "voluntarios";
    if (p.photoUrl) updates.photoUrl = String(p.photoUrl);
    if (p.active != null) updates.active = Boolean(p.active);
    const result = await updatePersonality(targetId, updates);
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar personalidade." };
    return { success: true, message: "Personalidade atualizada.", data: { adminPath: `/admin/personalidades/${targetId}` } };
  },
  // PROMOÇÕES
  list_promotions: async () => {
    const rows = await getAdminPromotions();
    return { success: true, message: `${rows.length} promoção(ões) encontrada(s).`, data: rows };
  },

  create_promotion: async (p) => {
    const result = await createPromotion({
      name: String(p.name),
      description: p.description ? String(p.description) : null,
      discountType: String(p.discountType) as "pct" | "fixed",
      discountValue: p.discountType === "fixed" ? brlToCents(p.discountValue) : Number(p.discountValue),
      appliesTo: String(p.appliesTo) as "all" | "tickets" | "products",
      minOrderCents: p.minOrderValueBRL ? brlToCents(p.minOrderValueBRL) : 0,
      startsAt: new Date(String(p.startsAt)),
      endsAt: new Date(String(p.endsAt)),
      flashSale: Boolean(p.flashSale ?? false),
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar promoção." };
    return { success: true, message: `Promoção "${p.name}" criada.`, data: { id: result.id, adminPath: `/admin/promocoes/${result.id}` } };
  },

  update_promotion: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminPromotions();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Promoção "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    const existing = await getAdminPromotions().then((rows) => rows.find((r) => r.id === targetId));
    if (!existing) return { success: false, message: "Promoção não encontrada." };
    const result = await updatePromotion(targetId, {
      name: p.name ? String(p.name) : existing.name,
      description: p.description !== undefined ? String(p.description) : existing.description,
      discountType: (p.discountType ? String(p.discountType) : existing.discountType) as "pct" | "fixed",
      discountValue: p.discountValue != null
        ? (p.discountType === "fixed" || existing.discountType === "fixed" ? brlToCents(p.discountValue) : Number(p.discountValue))
        : existing.discountValue,
      appliesTo: (p.appliesTo ? String(p.appliesTo) : existing.appliesTo) as "all" | "tickets" | "products",
      minOrderCents: p.minOrderValueBRL != null ? brlToCents(p.minOrderValueBRL) : existing.minOrderCents,
      startsAt: p.startsAt ? new Date(String(p.startsAt)) : existing.startsAt,
      endsAt: p.endsAt ? new Date(String(p.endsAt)) : existing.endsAt,
      flashSale: p.flashSale != null ? Boolean(p.flashSale) : existing.flashSale,
      active: p.active != null ? Boolean(p.active) : existing.active,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar." };
    return { success: true, message: `Promoção atualizada.`, data: { adminPath: `/admin/promocoes/${targetId}` } };
  },

  toggle_promotion_active: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminPromotions();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Promoção "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    await togglePromotionActive(targetId, Boolean(p.active));
    return { success: true, message: `Promoção ${p.active ? "ativada" : "pausada"}.` };
  },

  delete_promotion: async (p) => {
    let targetId = String(p.id);
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      const rows = await getAdminPromotions();
      const found = rows.find((r) => r.name.toLowerCase().includes(targetId.toLowerCase()));
      if (!found) return { success: false, message: `Promoção "${p.id}" não encontrada.` };
      targetId = found.id;
    }
    await deletePromotion(targetId);
    return { success: true, message: "Promoção excluída." };
  },

  // AFILIADOS
  list_affiliates: async () => {
    const rows = await getAdminAffiliates();
    return { success: true, message: `${rows.length} afiliado(s).`, data: rows };
  },

  create_affiliate: async (p) => {
    const { generateAffiliateCode } = await import("@/lib/affiliates/utils");
    const code = p.code ? String(p.code).toUpperCase() : generateAffiliateCode(String(p.name)).toUpperCase();
    const commissionValue = p.commissionType === "fixed"
      ? brlToCents(p.commissionValue)
      : Number(p.commissionValue);
    const result = await createAffiliate({
      name: String(p.name),
      email: String(p.email),
      whatsapp: p.whatsapp ? String(p.whatsapp) : null,
      code,
      commissionType: String(p.commissionType) as "pct" | "fixed",
      commissionValue,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar afiliado." };
    const siteUrl = process.env.APP_URL ?? "";
    return {
      success: true,
      message: `Afiliado "${p.name}" criado. Código: \`${code}\``,
      data: { id: result.id, code, referralLink: `${siteUrl}/?ref=${code}`, adminPath: `/admin/afiliados/${result.id}` },
    };
  },

  update_affiliate: async (p) => {
    const rows = await getAdminAffiliates();
    const idOrName = String(p.id);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? rows.find((r) => r.id === idOrName)
      : rows.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()) || r.email.toLowerCase() === idOrName.toLowerCase());
    if (!found) return { success: false, message: `Afiliado "${p.id}" não encontrado.` };
    const commissionValue = p.commissionValue != null
      ? (p.commissionType === "fixed" || found.commissionType === "fixed" ? brlToCents(p.commissionValue) : Number(p.commissionValue))
      : found.commissionValue;
    const result = await updateAffiliate(found.id, {
      name: p.name ? String(p.name) : found.name,
      email: p.email ? String(p.email) : found.email,
      whatsapp: p.whatsapp !== undefined ? String(p.whatsapp) : found.whatsapp,
      code: p.code ? String(p.code).toUpperCase() : found.code,
      commissionType: (p.commissionType ? String(p.commissionType) : found.commissionType) as "pct" | "fixed",
      commissionValue,
      active: p.active != null ? Boolean(p.active) : found.active,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar." };
    return { success: true, message: `Afiliado "${found.name}" atualizado.` };
  },

  delete_affiliate: async (p) => {
    const rows = await getAdminAffiliates();
    const idOrName = String(p.id);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? rows.find((r) => r.id === idOrName)
      : rows.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()) || r.email.toLowerCase() === idOrName.toLowerCase());
    if (!found) return { success: false, message: `Afiliado "${p.id}" não encontrado.` };
    await deleteAffiliate(found.id);
    return { success: true, message: `Afiliado "${found.name}" excluído.` };
  },

  list_affiliate_referrals: async (p) => {
    let affiliateId: string | undefined;
    if (p.affiliateId) {
      const rows = await getAdminAffiliates();
      const idOrName = String(p.affiliateId);
      const found = /^[0-9a-f-]{36}$/i.test(idOrName)
        ? rows.find((r) => r.id === idOrName)
        : rows.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()) || r.email.toLowerCase() === idOrName.toLowerCase());
      if (!found) return { success: false, message: `Afiliado "${p.affiliateId}" não encontrado.` };
      affiliateId = found.id;
    }
    const referrals = await getAffiliateReferrals(affiliateId);
    return { success: true, message: `${referrals.length} indicação(ões) encontrada(s).`, data: referrals };
  },

  mark_referrals_paid: async (p) => {
    const rows = await getAdminAffiliates();
    const idOrName = String(p.affiliateId);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? rows.find((r) => r.id === idOrName)
      : rows.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()) || r.email.toLowerCase() === idOrName.toLowerCase());
    if (!found) return { success: false, message: `Afiliado "${p.affiliateId}" não encontrado.` };
    const referrals = await getAffiliateReferrals(found.id);
    const pending = referrals.filter((r) => r.status === "pending").map((r) => r.id);
    if (pending.length === 0) return { success: true, message: `Nenhuma comissão pendente para ${found.name}.` };
    await markReferralsPaid(pending);
    const total = referrals.filter((r) => r.status === "pending").reduce((acc, r) => acc + r.commissionCents, 0);
    return { success: true, message: `${pending.length} comissão(ões) de ${found.name} marcada(s) como paga(s). Total: R$${(total / 100).toFixed(2)}.` };
  },

  // SÓCIO-TORCEDOR
  list_membership_plans: async () => {
    const rows = await getAdminMembershipPlans();
    return { success: true, message: `${rows.length} plano(s) encontrado(s).`, data: rows };
  },

  create_membership_plan: async (p) => {
    const name = String(p.name ?? "Novo Plano");
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const result = await createMembershipPlan({
      name,
      slug,
      icon: String(p.icon ?? "⭐"),
      description: p.description ? String(p.description) : null,
      priceCents: brlToCents(p.priceBRL),
      ticketDiscountPct: Number(p.ticketDiscountPct ?? 0),
      productDiscountPct: Number(p.productDiscountPct ?? 0),
      highlight: Boolean(p.highlight ?? false),
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar plano." };
    return { success: true, message: `Plano "${name}" criado.`, data: { id: result.id, adminPath: `/admin/socios/planos/${result.id}` } };
  },

  update_membership_plan: async (p) => {
    const plans = await getAdminMembershipPlans();
    const idOrName = String(p.id);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? plans.find((r) => r.id === idOrName)
      : plans.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()));
    if (!found) return { success: false, message: `Plano "${p.id}" não encontrado.` };
    const result = await updateMembershipPlan(found.id, {
      name: p.name ? String(p.name) : found.name,
      slug: found.slug,
      icon: p.icon ? String(p.icon) : found.icon,
      description: p.description !== undefined ? String(p.description) : found.description,
      priceCents: p.priceBRL != null ? brlToCents(p.priceBRL) : found.priceCents,
      ticketDiscountPct: p.ticketDiscountPct != null ? Number(p.ticketDiscountPct) : found.ticketDiscountPct,
      productDiscountPct: p.productDiscountPct != null ? Number(p.productDiscountPct) : found.productDiscountPct,
      highlight: p.highlight != null ? Boolean(p.highlight) : found.highlight,
      active: p.active != null ? Boolean(p.active) : found.active,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao atualizar plano." };
    return { success: true, message: `Plano "${found.name}" atualizado.` };
  },

  toggle_membership_plan_active: async (p) => {
    const plans = await getAdminMembershipPlans();
    const idOrName = String(p.id);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? plans.find((r) => r.id === idOrName)
      : plans.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()));
    if (!found) return { success: false, message: `Plano "${p.id}" não encontrado.` };
    await toggleMembershipPlanActive(found.id, Boolean(p.active));
    return { success: true, message: `Plano "${found.name}" ${p.active ? "ativado" : "desativado"}.` };
  },

  delete_membership_plan: async (p) => {
    const plans = await getAdminMembershipPlans();
    const idOrName = String(p.id);
    const found = /^[0-9a-f-]{36}$/i.test(idOrName)
      ? plans.find((r) => r.id === idOrName)
      : plans.find((r) => r.name.toLowerCase().includes(idOrName.toLowerCase()));
    if (!found) return { success: false, message: `Plano "${p.id}" não encontrado.` };
    await deleteMembershipPlan(found.id);
    return { success: true, message: `Plano "${found.name}" excluído.` };
  },

  list_members: async (p) => {
    const { rows, total } = await getAdminMembers({
      page: 1,
      status: p.status ? String(p.status) : undefined,
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Number(p.limit) : 20,
    });
    return { success: true, message: `${total} sócio(s) encontrado(s).`, data: rows };
  },

  activate_member: async (p) => {
    const idOrName = String(p.id);
    let memberId = idOrName;
    if (!/^[0-9a-f-]{36}$/i.test(idOrName)) {
      const { rows } = await getAdminMembers({ page: 1, search: idOrName, limit: 5 });
      if (!rows[0]) return { success: false, message: `Sócio "${p.id}" não encontrado.` };
      memberId = rows[0].id;
    }
    await activateMemberById(memberId);
    return { success: true, message: "Sócio ativado com sucesso." };
  },

  cancel_member: async (p) => {
    const idOrName = String(p.id);
    let memberId = idOrName;
    if (!/^[0-9a-f-]{36}$/i.test(idOrName)) {
      const { rows } = await getAdminMembers({ page: 1, search: idOrName, limit: 5 });
      if (!rows[0]) return { success: false, message: `Sócio "${p.id}" não encontrado.` };
      memberId = rows[0].id;
    }
    await updateMemberStatus(memberId, "cancelled");
    return { success: true, message: "Associação cancelada." };
  },
};

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
