import Image from "next/image";
import Link from "next/link";
import { getActiveHomeGames } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { Calendar, MapPin, Trophy, Ticket } from "lucide-react";

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
  const games = await getActiveHomeGames().catch(() => [] as ActiveGame[]);
  const game = games[0] ?? null;
  const otherGames = games.slice(1);

  if (!game) {
    return (
      <section id="ingressos" className="py-16 bg-card/50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-2">
              Próximo Jogo em Casa
            </p>
            <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-8">
              Garanta seu Ingresso
            </h2>
            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar size={26} className="text-primary" />
              </div>
              <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">
                Em Breve
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Nenhum jogo em casa programado no momento. Fique de olho nas novidades!
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const gameDate = new Date(game.date as unknown as string);
  const weekday = gameDate.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const dateShort = gameDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const time = gameDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

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
                  <CrestImage src="https://res.cloudinary.com/df798ispp/image/upload/misto/misto-logotipo.jpg" alt="Misto EC" />
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

          {/* Outros jogos com ingressos disponíveis */}
          {otherGames.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Ticket size={16} className="text-primary" />
                <p className="text-primary text-sm font-semibold tracking-widest uppercase">
                  Outros Jogos
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherGames.map((g) => (
                  <GameTicketCard key={g.id} game={g} />
                ))}
              </div>
            </div>
          )}
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
