import { db } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { and, eq, gt, asc } from "drizzle-orm";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";
import { getActivePromotionMeta } from "@/app/actions/promotions";
import { getSiteConfig, getAllSectionMeta } from "@/lib/config";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, Ticket } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Ingressos",
  description: "Compre ingressos para os jogos do Misto Esporte Clube em Três Lagoas/MS.",
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatGameDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

interface SerializedGame {
  id: string;
  opponent: string;
  opponentCrestUrl: string | null;
  date: string;
  venue: string;
  competition: string;
  round: string;
}

function GameListingCard({
  game,
  inteiraPriceCents,
  meiaPriceCents,
}: {
  game: SerializedGame;
  inteiraPriceCents: number;
  meiaPriceCents: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-5">
      {/* Teams */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Misto */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
            <span className="text-primary font-black text-[9px] text-center leading-tight">MISTO EC</span>
          </div>
          <span className="text-[11px] font-semibold text-foreground">Misto EC</span>
        </div>
        <span className="text-lg font-black text-muted-foreground shrink-0">VS</span>
        {/* Opponent */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {game.opponentCrestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.opponentCrestUrl} alt={game.opponent} className="w-12 h-12 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
              <span className="text-muted-foreground font-bold text-[9px] text-center leading-tight px-1">{game.opponent.slice(0, 8)}</span>
            </div>
          )}
          <span className="text-[11px] font-semibold text-foreground text-center leading-tight max-w-[4.5rem]">{game.opponent}</span>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 min-w-0 pl-2">
          <p className="text-[10px] text-primary font-semibold uppercase tracking-widest truncate">
            {game.competition} · {game.round}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar size={11} className="shrink-0" />
            <span className="capitalize">{formatGameDate(game.date)}</span>
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={11} className="shrink-0" />
            {game.venue}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Ticket size={11} className="shrink-0" />
            Inteira {formatPrice(inteiraPriceCents)} · Meia {formatPrice(meiaPriceCents)}
          </p>
        </div>
      </div>

      {/* Buy button */}
      <div className="shrink-0">
        <Link
          href={`/ingresso?jogo=${game.id}`}
          className="block text-center px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors text-sm whitespace-nowrap"
        >
          Comprar Ingresso
        </Link>
      </div>
    </div>
  );
}

export default async function IngressoPage({
  searchParams,
}: {
  searchParams: Promise<{ jogo?: string; cupom?: string }>;
}) {
  const { jogo: preSelectedGameId, cupom: initialCouponCode } = await searchParams;

  const sectionMeta = await getAllSectionMeta(["ticket_highlight"]);
  if (sectionMeta.ticket_highlight.enabled === false) redirect("/");

  const [homeGames, config, ticketPromotion] = await Promise.all([
    db
      .select()
      .from(games)
      .where(and(eq(games.isHome, true), eq(games.active, true), gt(games.date, new Date())))
      .orderBy(asc(games.date))
      .catch(() => []),
    getSiteConfig(),
    getActivePromotionMeta("tickets").catch(() => null),
  ]);

  const serializedGames = homeGames.map((g) => ({
    id: g.id,
    opponent: g.opponent,
    opponentCrestUrl: g.opponentCrestUrl ?? null,
    date: g.date.toISOString(),
    venue: g.venue,
    competition: g.competition,
    round: g.round,
  }));

  const inteiraPriceCents = config.ticketPriceInteiraCents as number;
  const meiaPriceCents = config.ticketPriceMeiaCents as number;

  // Listing mode: multiple games and no game pre-selected
  const showListing = serializedGames.length > 1 && !preSelectedGameId;

  return (
    <div className="min-h-screen py-12">
      <div className={`max-w-${showListing ? "3xl" : "7xl"} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="text-center mb-10">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-2">
            Bilheteria Digital
          </p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-5xl text-foreground">
            Comprar Ingressos
          </h1>
          {showListing && (
            <p className="text-muted-foreground text-sm mt-2">
              Escolha o jogo e compre seu ingresso com segurança.
            </p>
          )}
        </div>

        {showListing ? (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {serializedGames.map((game) => (
              <GameListingCard
                key={game.id}
                game={game}
                inteiraPriceCents={inteiraPriceCents}
                meiaPriceCents={meiaPriceCents}
              />
            ))}
          </div>
        ) : (
          <CheckoutWizard
            games={serializedGames}
            inteiraPriceCents={inteiraPriceCents}
            meiaPriceCents={meiaPriceCents}
            initialGameId={preSelectedGameId ?? null}
            initialCouponCode={initialCouponCode ?? null}
            ticketPromotion={ticketPromotion}
            whatsapp={config.whatsapp?.trim() || undefined}
          />
        )}
      </div>
    </div>
  );
}
