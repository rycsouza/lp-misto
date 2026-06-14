import { db } from "@/lib/db/client";
import { coupons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon } from "@/app/actions/admin-coupons";
import {
  getAdminUpsellOffers, createUpsellOffer, toggleUpsellOfferActive, deleteUpsellOffer,
} from "@/app/actions/admin-growth";
import {
  getAdminOrders, getAdminOrderDetail, cancelOrder, refundOrder,
} from "@/app/actions/admin";
import {
  getAdminGames, createGame, updateGame, toggleGameActive,
} from "@/app/actions/admin";
import { getAdminConfigRows, updateConfigValues } from "@/app/actions/admin";
import { getAdminCustomers, getAdminCustomerById } from "@/app/actions/admin-customers";
import { getAdminProducts, toggleProductActive } from "@/app/actions/admin-shop";

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

// ─── executor map ─────────────────────────────────────────────────────────────
export const executors: Record<string, (params: Params) => Promise<ExecutorResult>> = {

  // CUPONS
  list_coupons: async () => {
    const rows = await getAdminCoupons();
    return { success: true, message: `${rows.length} cupom(ns) encontrado(s).`, data: rows };
  },

  create_coupon: async (p) => {
    const result = await createCoupon({
      code: p.code ? String(p.code).toUpperCase() : generateCode(),
      discountType: String(p.discountType) as "pct" | "fixed",
      discountValue: Number(p.discountValue),
      appliesTo: String(p.appliesTo) as "order" | "tickets" | "products",
      description: p.description ? String(p.description) : null,
      minOrderCents: p.minOrderValueBRL ? brlToCents(p.minOrderValueBRL) : 0,
      maxUsages: p.maxUsages != null ? Number(p.maxUsages) : null,
      maxUsagesPerCustomer: p.maxUsagesPerCustomer != null ? Number(p.maxUsagesPerCustomer) : null,
      expiresAt: p.expiresAt ? String(p.expiresAt) : null,
      active: p.active !== false,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar cupom." };
    return { success: true, message: `Cupom criado com ID ${result.id}.`, data: result };
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
    const result = await createUpsellOffer({
      name: String(p.name ?? p.title ?? "Oferta"),
      description: p.description ? String(p.description) : null,
      triggerType: (p.triggerType ? String(p.triggerType) : "any") as "any" | "ticket" | "product" | "specific_product",
      offerType: String(p.offerType ?? "ticket") as "ticket" | "product",
      offerQuantity: p.offerQuantity ? Number(p.offerQuantity) : 1,
      originalPriceCents: p.originalPriceCents ? Number(p.originalPriceCents) : 0,
      discountPct: Number(p.discountPct ?? 0),
      active: p.active !== false,
      minOrderCents: p.minOrderValueBRL ? brlToCents(p.minOrderValueBRL) : 0,
      timerSeconds: p.timerMinutes ? Number(p.timerMinutes) * 60 : 0,
    });
    if (!result.success) return { success: false, message: result.error ?? "Erro ao criar oferta." };
    return { success: true, message: `Oferta de upsell criada com ID ${result.id}.` };
  },

  toggle_upsell_offer_active: async (p) => {
    await toggleUpsellOfferActive(String(p.id), Boolean(p.active));
    return { success: true, message: `Oferta ${p.active ? "ativada" : "desativada"}.` };
  },

  delete_upsell_offer: async (p) => {
    await deleteUpsellOffer(String(p.id));
    return { success: true, message: "Oferta de upsell excluída." };
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
    const { rows, total } = await getAdminGames({
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Number(p.limit) : 10,
    });
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
    return { success: true, message: `Jogo criado com ID ${result.id}.` };
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
    const { rows, total } = await getAdminProducts({
      page: 1,
      search: p.search ? String(p.search) : undefined,
      limit: p.limit ? Number(p.limit) : 10,
    });
    return { success: true, message: `${total} produto(s) encontrado(s).`, data: rows };
  },

  toggle_product_active: async (p) => {
    await toggleProductActive(String(p.id), Boolean(p.active));
    return { success: true, message: `Produto ${p.active ? "ativado" : "desativado"}.` };
  },
};

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
