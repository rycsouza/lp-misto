import Image from "next/image";
import Link from "next/link";
import { getNextHomeGame } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { Calendar, MapPin, Trophy } from "lucide-react";

function CrestImage({ src, alt }: { src?: string | null; alt: string }) {
  if (src) {
    return (
      <div className="relative w-16 h-16 shrink-0">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="64px"
          className="object-contain drop-shadow-md"
          onError={undefined}
        />
      </div>
    );
  }
  return (
    <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
      <span className="font-[family-name:var(--font-bebas-neue)] text-lg text-muted-foreground">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

async function TicketHighlightContent() {
  const game = await getNextHomeGame().catch(() => null);
  if (!game) return null;

  const gameDate = new Date(game.date as unknown as string);
  const weekday = gameDate.toLocaleDateString("pt-BR", { weekday: "long" });
  const dateShort = gameDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = gameDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const buyUrl = `/ingresso?jogo=${game.id}`;

  return (
    <section id="ingressos" className="py-16 bg-card/50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
            Próximo Jogo em Casa
          </p>
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-8">
            Garanta seu Ingresso
          </h2>

          <div className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-[0_0_20px_rgba(193,154,90,0.3)] transition-all">
            {/* competition badge */}
            <div className="bg-primary/10 border-b border-border px-5 py-2 flex items-center gap-2">
              <Trophy size={13} className="text-primary" />
              <span className="text-xs text-primary font-semibold tracking-widest uppercase">
                {game.competition} · {game.round}
              </span>
            </div>

            <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
              {/* teams */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <CrestImage src="/misto-logotipo.jpeg" alt="Misto EC" />
                  <span className="text-xs text-muted-foreground font-medium">Misto EC</span>
                </div>
                <span className="font-[family-name:var(--font-bebas-neue)] text-2xl text-muted-foreground">
                  VS
                </span>
                <div className="flex flex-col items-center gap-1">
                  <CrestImage src={game.opponentCrestUrl} alt={game.opponent} />
                  <span className="text-xs text-muted-foreground font-medium truncate max-w-[80px] text-center">
                    {game.opponent}
                  </span>
                </div>
              </div>

              {/* info */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <p className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground">
                  Misto EC vs {game.opponent}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground">
                  <Calendar size={13} className="text-primary shrink-0" />
                  <span className="capitalize">{weekday}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{dateShort}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-primary font-medium">{time}</span>
                </div>
                <div className="flex items-start justify-center sm:justify-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin size={13} className="text-primary shrink-0 mt-0.5" />
                  <span className="leading-tight">{game.venue.replace(" — ", ", ")}</span>
                </div>
              </div>

              {/* CTA */}
              <Link
                href={buyUrl}
                className="shrink-0 px-7 py-3 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-lg rounded-lg hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all"
              >
                Comprar Ingresso
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function TicketHighlight() {
  return (
    <SectionWrapper sectionKey="ticket_highlight">
      <TicketHighlightContent />
    </SectionWrapper>
  );
}
