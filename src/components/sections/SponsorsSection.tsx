import Image from "next/image";
import { getActiveSponsors } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { SponsorLeadForm } from "./SponsorLeadForm";
import { SponsorsMarqueeClient } from "./SponsorsMarqueeClient";

type Sponsor = Awaited<ReturnType<typeof getActiveSponsors>>[number];

function DiamondSponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const bg = sponsor.logoTone === "dark" ? "bg-white" : "bg-secondary/80";

  const card = (
    <div
      className={`
        group relative w-40 h-20 sm:w-44 sm:h-24 rounded-xl ${bg}
        flex items-center justify-center p-3
        ring-1 ring-amber-400/50
        shadow-[0_0_18px_2px_rgba(251,191,36,0.12)]
        transition-all duration-300
        hover:ring-amber-400/80 hover:shadow-[0_0_28px_4px_rgba(251,191,36,0.22)]
      `}
    >
      {sponsor.logoUrl ? (
        <Image
          src={sponsor.logoUrl}
          alt={sponsor.name}
          fill
          sizes="176px"
          className="object-contain p-3"
        />
      ) : (
        <span className="text-xs font-semibold text-center text-foreground/70 leading-tight px-2">
          {sponsor.name}
        </span>
      )}
    </div>
  );

  if (sponsor.instagramUrl) {
    return (
      <a
        href={sponsor.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={sponsor.name}
        className="transition-transform hover:-translate-y-0.5"
      >
        {card}
      </a>
    );
  }
  return card;
}

async function SponsorsSectionContent() {
  const allSponsors = await getActiveSponsors().catch(() => []);

  const diamante = allSponsors.filter((s) => s.tier === "diamante");
  const others = allSponsors.filter((s) => s.tier !== "diamante");

  return (
    <section id="patrocinadores" className="py-16 bg-card/20 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Parceiros
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Patrocinadores
        </h2>

        {allSponsors.length === 0 && (
          <p className="text-muted-foreground text-center mb-12">Em breve.</p>
        )}

        {/* ── Diamante ─────────────────────────────────────────────────────── */}
        {diamante.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-amber-400/40" />
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-amber-400/80">
                ✦ Diamante
              </span>
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-amber-400/40" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5">
              {diamante.map((s) => (
                <DiamondSponsorCard key={s.id} sponsor={s} />
              ))}
            </div>
          </div>
        )}

        {/* ── Demais tiers — marquee ────────────────────────────────────────── */}
        {others.length > 0 && (
          <div className={diamante.length > 0 ? "border-t border-border/40 pt-8 mb-12" : "mb-12"}>
            {diamante.length > 0 && (
              <p className="text-xs text-muted-foreground/60 text-center uppercase tracking-widest mb-6">
                Outros Parceiros
              </p>
            )}
            <SponsorsMarqueeClient
              sponsors={others.map((s) => ({
                ...s,
                logoTone: s.logoTone as "light" | "dark",
              }))}
            />
          </div>
        )}

        {/* ── Seja um Patrocinador ──────────────────────────────────────────── */}
        <div className="border-t border-border pt-12">
          <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-center text-foreground mb-2">
            Seja um Patrocinador
          </h3>
          <p className="text-muted-foreground text-center text-sm mb-8">
            Associe sua marca ao Carcará da Fronteira e ganhe visibilidade em toda a região.
          </p>
          <SponsorLeadForm />
        </div>
      </div>
    </section>
  );
}

export default async function SponsorsSection() {
  return (
    <SectionWrapper sectionKey="sponsors">
      <SponsorsSectionContent />
    </SectionWrapper>
  );
}
