import { asc, eq, isNull, sql } from "drizzle-orm";
import { ticketTypes } from "@/lib/db/schema";
import type { getDb } from "@/lib/db/client";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Reconcilia o soldCount dos tipos de UM jogo a partir da realidade dos pedidos:
 * quantidade comprometida = itens de ingresso (não-upsell) de pedidos pagos OU
 * PIX pendente ainda na janela (30min). Chamado após salvar tipos (o delete+insert
 * zera o contador) e no snapshot, para o limite valer mesmo com vendas pré-existentes.
 */
export async function reconcileSoldCounts(db: Db, gameId: string): Promise<void> {
  await db.execute(sql`
    UPDATE ticket_types tt SET sold_count = COALESCE((
      SELECT SUM(oi.quantity) FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.type = 'ticket'
        AND oi.reference_id = tt.game_id
        AND oi.metadata->>'ticketType' = tt.code
        AND (oi.metadata->>'isUpsell') IS DISTINCT FROM 'true'
        AND (o.status = 'paid' OR (o.status = 'pending' AND o.created_at > now() - interval '30 minutes'))
    ), 0)
    WHERE tt.game_id = ${gameId}
  `);
}

/**
 * Copia os tipos GLOBAIS (padrão do clube) para um jogo, se ele ainda não tiver
 * tipos próprios. Idempotente. Usado ao criar o jogo (snapshot) e no backfill dos
 * jogos existentes — assim o operador ajusta preço/limite por jogo sem recriar.
 */
export async function snapshotGlobalTypesToGame(db: Db, gameId: string): Promise<void> {
  try {
    const own = await db
      .select({ id: ticketTypes.id })
      .from(ticketTypes)
      .where(eq(ticketTypes.gameId, gameId))
      .limit(1);
    if (own.length > 0) return; // já tem tipos próprios — não sobrescreve

    const globals = await db
      .select()
      .from(ticketTypes)
      .where(isNull(ticketTypes.gameId))
      .orderBy(asc(ticketTypes.sortOrder));
    if (globals.length === 0) return; // sem padrão global — jogo usa fallback

    await db.insert(ticketTypes).values(
      globals.map((g) => ({
        gameId,
        code: g.code,
        name: g.name,
        description: g.description,
        priceCents: g.priceCents,
        comboTiers: g.comboTiers,
        maxQuantity: g.maxQuantity,
        soldCount: 0,
        sortOrder: g.sortOrder,
        active: g.active,
      }))
    );
    // Se já houver vendas deste jogo (backfill), semeia o contador corretamente.
    await reconcileSoldCounts(db, gameId);
  } catch (err) {
    console.error("snapshotGlobalTypesToGame error:", err);
  }
}
