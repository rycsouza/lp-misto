import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { listBarMenuItems, getBarConfigForAdmin } from "@/app/actions/bar";
import { BarCardapioAdmin } from "@/components/bar/BarCardapioAdmin";

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

export default async function BarCardapioPage() {
  const [items, config, gamesList] = await Promise.all([
    listBarMenuItems(),
    getBarConfigForAdmin(),
    loadGames(),
  ]);

  return (
    <div className="p-4 sm:p-6">
      <BarCardapioAdmin initialItems={items} games={gamesList} initialConfig={config} />
    </div>
  );
}
