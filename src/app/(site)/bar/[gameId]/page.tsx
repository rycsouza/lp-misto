import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { getBarCardapio } from "@/app/actions/bar";
import { getBarConfig } from "@/lib/bar/config";
import { BarOrderFlow } from "@/components/bar/BarOrderFlow";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BarGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (!UUID_RE.test(gameId)) notFound();

  const db = await getDb();
  const [game] = await db
    .select({ id: games.id, opponent: games.opponent, date: games.date, venue: games.venue })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!game) notFound();

  const [cardapio, config] = await Promise.all([getBarCardapio(gameId), getBarConfig()]);

  const dateStr = new Date(game.date as unknown as string).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-1">Bar do jogo</p>
      <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-6">
        Peça sem sair do seu lugar
      </h1>
      <BarOrderFlow
        gameId={gameId}
        gameLabel={`vs ${game.opponent} · ${dateStr} · ${game.venue}`}
        cardapio={cardapio}
        config={config}
      />
    </div>
  );
}
