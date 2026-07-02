import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { games, barGameOfferings } from "@/lib/db/schema";
import { Beer } from "lucide-react";

export default async function BarIndexPage() {
  const db = await getDb();

  const withBar = await db
    .selectDistinct({ gameId: barGameOfferings.gameId })
    .from(barGameOfferings)
    .where(eq(barGameOfferings.active, true));
  const ids = withBar.map((r) => r.gameId);

  const list = ids.length
    ? await db
        .select({ id: games.id, opponent: games.opponent, date: games.date, venue: games.venue })
        .from(games)
        .where(and(inArray(games.id, ids), eq(games.active, true)))
        .orderBy(asc(games.date))
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Bar Online</p>
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-6">Escolha o jogo</h1>

      {list.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhum jogo com bar disponível no momento.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((g) => {
            const dateStr = new Date(g.date as unknown as string).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              timeZone: "America/Sao_Paulo",
            });
            return (
              <Link
                key={g.id}
                href={`/bar/${g.id}`}
                className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Beer size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">vs {g.opponent}</p>
                  <p className="text-xs text-muted-foreground truncate">{dateStr} · {g.venue}</p>
                </div>
                <span className="text-primary text-sm group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
