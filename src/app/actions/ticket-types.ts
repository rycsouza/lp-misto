"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { ticketTypes } from "@/lib/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import { getAdminSession } from "./admin-auth";
import { getSiteConfig } from "@/lib/config";
import { slugifyTypeCode } from "@/lib/tickets/resolve";
import { parseBundleTiers, type BundleTier } from "@/lib/promotions/bundle";

export interface TicketTypeInput {
  name: string;
  description?: string | null;
  priceCents: number;
  comboTiers?: BundleTier[];
  code?: string | null;
}

export interface TicketTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  comboTiers: BundleTier[];
  sortOrder: number;
}

/** Lê os tipos de um escopo (gameId = jogo específico, null = catálogo global). */
export async function getTicketTypesAdmin(
  gameId: string | null
): Promise<TicketTypeRow[]> {
  const rows = await db
    .select()
    .from(ticketTypes)
    .where(gameId ? eq(ticketTypes.gameId, gameId) : isNull(ticketTypes.gameId))
    .orderBy(asc(ticketTypes.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    priceCents: r.priceCents,
    comboTiers: parseBundleTiers(r.comboTiers),
    sortOrder: r.sortOrder,
  }));
}

/**
 * Substitui todos os tipos de um escopo pela lista informada.
 * Lista vazia = remove os tipos do escopo (jogo passa a usar o global / global zera).
 */
export async function saveTicketTypes(
  gameId: string | null,
  types: TicketTypeInput[]
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: "Não autorizado." };
  if (session.role !== "admin" && !session.permissions?.jogos) {
    return { success: false, error: "Sem permissão." };
  }

  const clean = types
    .map((t, i) => ({
      name: (t.name ?? "").trim(),
      description: (t.description ?? "")?.toString().trim() || null,
      priceCents: Math.max(0, Math.round(Number(t.priceCents) || 0)),
      comboTiers: parseBundleTiers(t.comboTiers),
      sortOrder: i,
    }))
    .filter((t) => t.name.length > 0);

  // codes únicos dentro do escopo
  const used = new Set<string>();
  const rows = clean.map((t) => {
    let code = slugifyTypeCode(t.name);
    let n = 2;
    while (used.has(code)) code = `${slugifyTypeCode(t.name)}-${n++}`;
    used.add(code);
    return { ...t, code, gameId: gameId ?? null, active: true };
  });

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(ticketTypes)
        .where(gameId ? eq(ticketTypes.gameId, gameId) : isNull(ticketTypes.gameId));
      if (rows.length > 0) await tx.insert(ticketTypes).values(rows);
    });
    revalidatePath("/admin/configuracoes");
    if (gameId) revalidatePath(`/admin/jogos/${gameId}`);
    return { success: true };
  } catch (err) {
    console.error("saveTicketTypes error:", err);
    return { success: false, error: "Erro ao salvar tipos de ingresso." };
  }
}

/**
 * Garante que existem tipos globais. Se o catálogo global estiver vazio,
 * cria Inteira/Meia a partir dos valores atuais do site_config (sem perder nada).
 * Idempotente — não faz nada se já houver tipos globais.
 */
export async function ensureDefaultGlobalTypes(): Promise<void> {
  try {
    const existing = await db
      .select({ id: ticketTypes.id })
      .from(ticketTypes)
      .where(isNull(ticketTypes.gameId))
      .limit(1);
    if (existing.length > 0) return;

    const config = await getSiteConfig();
    await db.insert(ticketTypes).values([
      {
        gameId: null,
        code: "inteira",
        name: "Inteira",
        description: null,
        priceCents: config.ticketPriceInteiraCents,
        sortOrder: 0,
        active: true,
      },
      {
        gameId: null,
        code: "meia",
        name: "Meia-entrada",
        description: config.meiaEligibilityLabel || null,
        priceCents: config.ticketPriceMeiaCents,
        sortOrder: 1,
        active: true,
      },
    ]);
  } catch {
    /* tabela não migrada ainda — ignora */
  }
}
