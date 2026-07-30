import { and, eq, sql } from "drizzle-orm";
import { ticketTypes } from "@/lib/db/schema";
import type { getDb } from "@/lib/db/client";

type Db = Awaited<ReturnType<typeof getDb>>;

export interface ReserveLine {
  id: string;
  name: string;
  quantity: number;
}

/**
 * Reserva atômica de estoque de ingresso (só tipos COM limite).
 *
 * Para cada linha, incrementa `sold_count` no MESMO UPDATE em que confere o teto
 * (`sold_count + qty <= max_quantity`) — à prova de corrida, sem transação (igual
 * ao padrão de estoque de produto). Se alguma linha não couber, DESFAZ as já
 * reservadas nesta tentativa e devolve o nome do tipo esgotado.
 *
 * Passe apenas tipos por-jogo com `maxQuantity != null`; ilimitados não entram aqui.
 */
export async function reserveTicketStock(
  db: Db,
  lines: ReserveLine[]
): Promise<{ ok: true } | { ok: false; soldOutName: string }> {
  const done: ReserveLine[] = [];
  for (const line of lines) {
    const res = await db
      .update(ticketTypes)
      .set({ soldCount: sql`${ticketTypes.soldCount} + ${line.quantity}` })
      .where(
        and(
          eq(ticketTypes.id, line.id),
          sql`(${ticketTypes.maxQuantity} IS NULL OR ${ticketTypes.soldCount} + ${line.quantity} <= ${ticketTypes.maxQuantity})`
        )
      )
      .returning({ id: ticketTypes.id });

    if (res.length === 0) {
      await releaseTicketStockById(db, done);
      return { ok: false, soldOutName: line.name };
    }
    done.push(line);
  }
  return { ok: true };
}

/** Devolve ao pool a reserva de linhas por id (rollback imediato). */
export async function releaseTicketStockById(
  db: Db,
  lines: { id: string; quantity: number }[]
): Promise<void> {
  for (const line of lines) {
    await db
      .update(ticketTypes)
      .set({ soldCount: sql`GREATEST(0, ${ticketTypes.soldCount} - ${line.quantity})` })
      .where(eq(ticketTypes.id, line.id));
  }
}
