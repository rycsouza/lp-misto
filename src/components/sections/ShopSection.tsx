import Link from "next/link";
import Image from "next/image";
import { getActiveProducts, getActiveHomeGames } from "@/lib/db/queries";
import { getActiveFlashSale, getActivePromotionMeta } from "@/app/actions/promotions";
import { computePromotionDiscount } from "@/lib/promotions/utils";
import SectionWrapper from "@/components/ui/section-wrapper";
import { ShopProductCard } from "@/components/ui/ShopProductCard";
import { FlashSaleBanner } from "@/components/ui/FlashSaleBanner";
import { Calendar, MapPin, Ticket } from "lucide-react";

type ActiveGame = Awaited<ReturnType<typeof getActiveHomeGames>>[number];

function GameTicketCard({ game }: { game: ActiveGame }) {
  const gameDate = new Date(game.date as unknown as string);
  const dateStr = gameDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const weekday = gameDate.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  const timeStr = gameDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <Link
      href={`/ingresso?jogo=${game.id}`}
      className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-[0_0_12px_rgba(193,154,90,0.15)] transition-all group"
    >
      {/* crest */}
      <div className="shrink-0 w-10 h-10 relative">
        {game.opponentCrestUrl ? (
          <Image src={game.opponentCrestUrl} alt={game.opponent} fill sizes="40px" className="object-contain" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
            <span className="font-[family-name:var(--font-bebas-neue)] text-sm text-muted-foreground">
              {game.opponent.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary font-semibold uppercase tracking-widest truncate">
          {game.competition} · {game.round}
        </p>
        <p className="text-sm font-medium text-foreground truncate">Misto EC vs {game.opponent}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Calendar size={11} className="shrink-0 text-primary" />
          <span className="capitalize">{weekday}</span>
          <span>{dateStr} · {timeStr}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin size={11} className="shrink-0 text-primary" />
          <span className="truncate">{game.venue}</span>
        </div>
      </div>

      {/* cta */}
      <span className="shrink-0 text-xs font-semibold text-primary group-hover:text-primary/80 transition-colors">
        Comprar →
      </span>
    </Link>
  );
}

async function ShopSectionContent() {
  const [products, flashSale, promo, activeGames] = await Promise.all([
    getActiveProducts().catch(() => []),
    getActiveFlashSale("products").catch(() => null),
    getActivePromotionMeta("products").catch(() => null),
    getActiveHomeGames().catch(() => [] as ActiveGame[]),
  ]);

  return (
    <section id="loja" className="py-16 bg-card/10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Loja Oficial
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-6">
          Produtos
        </h2>

        {/* Ingressos disponíveis — só aparece quando há múltiplos jogos ativos */}
        {activeGames.length > 1 && (
          <div className="mb-10">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Ticket size={16} className="text-primary" />
              <p className="text-primary text-sm font-semibold tracking-widest uppercase">
                Ingressos Disponíveis
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
              {activeGames.map((game) => (
                <GameTicketCard key={game.id} game={game} />
              ))}
            </div>
            <div className="border-t border-border mt-8 mb-2" />
          </div>
        )}

        {flashSale && (
          <div className="mb-8">
            <FlashSaleBanner name={flashSale.name} endsAt={flashSale.endsAt.toISOString()} />
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-muted-foreground text-center">Produtos em breve.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {products.map((product) => {
              // Product-level sale price takes priority; otherwise compute from active promotion
              let displaySalePriceCents = product.salePriceCents ?? null;
              let displayOnSale = product.onSale ?? false;
              if (!displayOnSale && promo) {
                const discountCents = computePromotionDiscount(product.priceCents, promo);
                if (discountCents > 0) {
                  displaySalePriceCents = product.priceCents - discountCents;
                  displayOnSale = true;
                }
              }
              return (
                <ShopProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  name={product.name}
                  imageUrl={product.imageUrl}
                  priceCents={product.priceCents}
                  salePriceCents={displaySalePriceCents}
                  onSale={displayOnSale}
                  variantCount={product.variantCount}
                  colorVariants={product.colorVariants}
                  comingSoon={product.comingSoon}
                  lowStock={product.limitedStock}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ShopSection() {
  return (
    <SectionWrapper sectionKey="shop">
      <ShopSectionContent />
    </SectionWrapper>
  );
}
