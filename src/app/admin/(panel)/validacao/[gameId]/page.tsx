export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getHomeGamesForValidation, getGameValidationStats, getRecentValidations, getTicketTypesForGame } from "@/app/actions/validations";
import { getSiteConfig } from "@/lib/config";
import { ValidationScanner } from "./ValidationScanner";

interface PageProps {
  params: Promise<{ gameId: string }>;
}

function fmtGameDate(isoStr: string) {
  return new Date(isoStr).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function GameValidationPage({ params }: PageProps) {
  const { gameId } = await params;

  const games = await getHomeGamesForValidation();
  const game = games.find((g) => g.id === gameId);
  if (!game) notFound();

  const [stats, recent, ticketTypes, config] = await Promise.all([
    getGameValidationStats(gameId),
    getRecentValidations(gameId, 12),
    getTicketTypesForGame(gameId),
    getSiteConfig(),
  ]);

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div className="flex items-start gap-3">
        <Link
          href="/admin/validacao"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{game.competition} · {game.round}</p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground leading-tight">
            {config.siteName ? `${config.siteName} vs ${game.opponent}` : game.opponent}
          </h1>
          <p className="text-sm text-muted-foreground">{fmtGameDate(game.date)} · {game.venue}</p>
        </div>
      </div>

      <ValidationScanner
        gameId={gameId}
        initialStats={stats}
        initialRecent={recent}
        ticketTypes={ticketTypes}
      />
    </div>
  );
}
