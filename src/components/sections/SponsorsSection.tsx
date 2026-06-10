import { getActiveSponsors } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { SponsorLeadForm } from "./SponsorLeadForm";
import { SponsorsMarqueeClient } from "./SponsorsMarqueeClient";

async function SponsorsSectionContent() {
  const sponsors = await getActiveSponsors().catch(() => []);

  return (
    <section id="patrocinadores" className="py-16 bg-card/20 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Parceiros
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Patrocinadores
        </h2>

        {sponsors.length > 0 ? (
          <div className="mb-12">
            <SponsorsMarqueeClient
              sponsors={sponsors.map((s) => ({
                ...s,
                logoTone: s.logoTone as "light" | "dark",
              }))}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center mb-12">Em breve.</p>
        )}

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
