import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { BarPrepPanel } from "@/components/bar/BarPrepPanel";

async function loadGames() {
  const db = await getDb();
  const rows = await db
    .select({ id: games.id, opponent: games.opponent, date: games.date })
    .from(games)
    .where(and(eq(games.isHome, true), eq(games.active, true)))
    .orderBy(desc(games.date))
    .limit(50);
  return rows.map((g) => {
    const d = new Date(g.date as unknown as string).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
    });
    return { id: g.id, label: `vs ${g.opponent} · ${d}` };
  });
}

export default async function BarPreparoPage() {
  const gamesList = await loadGames();
  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-muted-foreground mb-4">Fichas pagas em preparo — marque como pronta quando terminar.</p>
      <BarPrepPanel games={gamesList} />
    </div>
  );
}
