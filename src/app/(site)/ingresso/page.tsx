import { db } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { and, eq, gt, asc } from "drizzle-orm";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";
import { getActivePromotionMeta } from "@/app/actions/promotions";
import { getSiteConfig } from "@/lib/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ingressos",
  description: "Compre ingressos para os jogos do Misto Esporte Clube em Três Lagoas/MS.",
};

export default async function IngressoPage({
  searchParams,
}: {
  searchParams: Promise<{ jogo?: string; cupom?: string }>;
}) {
  const { jogo: preSelectedGameId, cupom: initialCouponCode } = await searchParams;
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
    date: g.date.toISOString(),
    venue: g.venue,
    competition: g.competition,
    round: g.round,
  }));

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-2">
            Bilheteria Digital
          </p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-5xl text-foreground">
            Comprar Ingressos
          </h1>
        </div>

        <CheckoutWizard
          games={serializedGames}
          inteiraPriceCents={config.ticketPriceInteiraCents as number}
          meiaPriceCents={config.ticketPriceMeiaCents as number}
          initialGameId={preSelectedGameId ?? null}
          initialCouponCode={initialCouponCode ?? null}
          ticketPromotion={ticketPromotion}
        />
      </div>
    </div>
  );
}
