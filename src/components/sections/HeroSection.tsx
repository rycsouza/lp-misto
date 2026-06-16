import Image from "next/image";
import Link from "next/link";
import { getNextHomeGame, getNextGame, getAllSiteConfig } from "@/lib/db/queries";
import { CountdownTimer } from "@/components/ui/countdown-timer";

const STATS = [
  { value: "1993", label: "Fundação" },
  { value: "Série B 2026", label: "Competição" },
  { value: "Três Lagoas/MS", label: "Nossa cidade" },
];

export default async function HeroSection() {
  const [nextHomeGame, nextGame, configRows] = await Promise.all([
    getNextHomeGame().catch(() => null),
    getNextGame().catch(() => null),
    getAllSiteConfig().catch(() => []),
  ]);

  const heroImageUrl =
    configRows.find((r) => r.key === "hero.image_url")?.value ?? "https://res.cloudinary.com/df798ispp/image/upload/misto/hero-player.jpg";
  const membershipEnabled =
    configRows.find((r) => r.key === "section.membership.enabled")?.value !== "false";
  const ticketEnabled =
    configRows.find((r) => r.key === "section.ticket_highlight.enabled")?.value !== "false";

  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src={heroImageUrl}
          alt="Jogador do Misto Esporte Clube"
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-background/70" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-3xl">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-4">
            Misto Esporte Clube
          </p>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-6xl sm:text-8xl lg:text-9xl text-foreground leading-none mb-6">
            Carcará da<br />
            <span className="text-primary">Fronteira</span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl mb-8 max-w-xl">
            Garra, paixão e tradição. Representando Três Lagoas com orgulho no futebol brasileiro.
          </p>

          {nextGame && (
            <div className="mb-8">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                Próximo jogo
              </p>
              <CountdownTimer targetDate={new Date(nextGame.date).toISOString()} />
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-12">
            {ticketEnabled && (
              <Link
                href="/ingresso"
                className="px-8 py-4 bg-primary text-primary-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all"
              >
                Comprar Ingresso
              </Link>
            )}
            {membershipEnabled && (
              <a
                href="#socio"
                className="px-8 py-4 bg-secondary text-foreground font-[family-name:var(--font-bebas-neue)] text-xl rounded-md hover:bg-secondary/80 transition-all border border-border"
              >
                Seja Sócio
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
