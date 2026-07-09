export const dynamic = "force-dynamic";

import { getAdminGameById } from "@/app/actions/admin";
import { GameForm } from "@/components/admin/GameForm";
import { TicketTypesEditor } from "@/components/admin/TicketTypesEditor";
import { getTicketTypesAdmin } from "@/app/actions/ticket-types";
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

  const gameTicketTypes = await getTicketTypesAdmin(id);

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
            ticketSalesEndsAt: game.ticketSalesEndsAt,
            isHome: game.isHome,
            opponent: game.opponent,
            opponentCrestUrl: game.opponentCrestUrl,
            venue: game.venue,
            ticketPriceInteiraCents: game.ticketPriceInteiraCents,
            ticketPriceMeiaCents: game.ticketPriceMeiaCents,
            meiaEligibilityLabel: game.meiaEligibilityLabel,
            active: game.active,
          }}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground">Tipos de ingresso deste jogo</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina tipos específicos para este jogo (preços e definições próprios).
            Deixe vazio para usar o catálogo global de Configurações → Ingressos.
          </p>
        </div>
        <TicketTypesEditor
          scope={game.id}
          initial={gameTicketTypes.map((t) => ({
            name: t.name,
            description: t.description,
            priceCents: t.priceCents,
            comboTiers: t.comboTiers,
          }))}
          emptyHint="Sem tipos próprios — este jogo usa o catálogo global."
        />
      </div>
    </div>
  );
}
