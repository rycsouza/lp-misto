import { getAdminGameById } from "@/app/actions/admin";
import { GameForm } from "@/components/admin/GameForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarJogoPage({ params }: PageProps) {
  const { id } = await params;
  const game = await getAdminGameById(id);

  if (!game) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/jogos"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para jogos
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR JOGO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <GameForm
          game={{
            id: game.id,
            season: game.season,
            competition: game.competition,
            round: game.round,
            date: game.date,
            isHome: game.isHome,
            opponent: game.opponent,
            opponentCrestUrl: game.opponentCrestUrl,
            venue: game.venue,
            active: game.active,
          }}
        />
      </div>
    </div>
  );
}
