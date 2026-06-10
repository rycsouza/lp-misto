import {
  getTimelineEvents,
  getActiveLegends,
  getActivePersonalities,
} from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { Avatar } from "@/components/ui/avatar";
import { LegendsMarqueeClient } from "./LegendsMarqueeClient";

const PERSONALITY_LABELS: Record<string, string> = {
  medicos: "Médicos",
  dirigentes: "Dirigentes Históricos",
  tecnicos: "Técnicos",
  voluntarios: "Voluntários",
};

async function HistorySectionContent() {
  const [events, legends, personalities] = await Promise.all([
    getTimelineEvents().catch(() => []),
    getActiveLegends().catch(() => []),
    getActivePersonalities().catch(() => []),
  ]);

  type PersonalityItem = (typeof personalities)[number];
  const personalityGroups = personalities.reduce<Record<string, PersonalityItem[]>>(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    },
    {}
  );

  return (
    <section id="historia" className="py-16 bg-card/20 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Desde 1993
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-12">
          Nossa História
        </h2>

        {events.length > 0 && (
          <div className="mb-16">
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-8 text-center">
              Linha do Tempo
            </h3>
            <div className="relative">
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-8">
                {events.map((event, idx) => (
                  <div
                    key={event.id}
                    className={`relative flex items-start gap-6 ${idx % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                  >
                    <div
                      className={`hidden md:block w-1/2 ${idx % 2 === 0 ? "text-right pr-8" : "pl-8"}`}
                    >
                      <span className="font-[family-name:var(--font-bebas-neue)] text-5xl text-primary/30">
                        {event.year}
                      </span>
                    </div>
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary mt-1.5" />
                    <div className="ml-10 md:ml-0 md:w-1/2 md:pl-8">
                      <span className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary md:hidden">
                        {event.year}
                      </span>
                      <h4 className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground">
                        {event.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {legends.length > 0 && (
          <div className="mb-16">
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-8 text-center">
              Lendas do Clube
            </h3>
            <LegendsMarqueeClient legends={legends} />
          </div>
        )}

        {Object.keys(personalityGroups).length > 0 && (
          <div>
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-8 text-center">
              Personalidades
            </h3>
            {Object.entries(personalityGroups).map(([cat, people]) => (
              <div key={cat} className="mb-10">
                <h4 className="font-[family-name:var(--font-bebas-neue)] text-xl text-foreground mb-4 border-b border-border pb-2">
                  {PERSONALITY_LABELS[cat] ?? cat}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {people.map((person) => (
                    <div
                      key={person.id}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <Avatar name={person.name} photoUrl={person.photoUrl} size={72} />
                      <p className="text-sm font-semibold text-foreground">{person.name}</p>
                      {person.role && (
                        <p className="text-xs text-muted-foreground">{person.role}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function HistorySection() {
  return (
    <SectionWrapper sectionKey="history">
      <HistorySectionContent />
    </SectionWrapper>
  );
}
