import { getActivePlayers } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { Avatar } from "@/components/ui/avatar";

const POSITION_LABELS: Record<string, string> = {
  goleiro: "Goleiros",
  zagueiro: "Zagueiros",
  lateral: "Laterais",
  volante: "Volantes",
  meia: "Meias",
  atacante: "Atacantes",
};

const POSITION_ORDER = ["goleiro", "zagueiro", "lateral", "volante", "meia", "atacante"];

async function SquadSectionContent() {
  const players = await getActivePlayers(2026).catch(() => []);

  if (players.length === 0) {
    return (
      <section id="elenco" className="py-16 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-primary text-sm font-semibold tracking-widest uppercase mb-2">Elenco</p>
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground mb-6">
            Elenco 2026
          </h2>
          <p className="text-muted-foreground text-lg">Elenco em breve.</p>
        </div>
      </section>
    );
  }

  const grouped = POSITION_ORDER.reduce<Record<string, typeof players>>((acc, pos) => {
    const group = players.filter((p) => p.position === pos);
    if (group.length > 0) acc[pos] = group;
    return acc;
  }, {});

  return (
    <section id="elenco" className="py-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Temporada 2026
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Elenco
        </h2>

        {Object.entries(grouped).map(([pos, group]) => (
          <div key={pos} className="mb-10">
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-5 border-b border-border pb-2">
              {POSITION_LABELS[pos] ?? pos}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {group.map((player) => (
                <div
                  key={player.id}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all"
                >
                  <Avatar name={player.name} photoUrl={player.photoUrl} size={80} />
                  {player.number != null && (
                    <span className="font-[family-name:var(--font-bebas-neue)] text-3xl text-primary leading-none">
                      {player.number}
                    </span>
                  )}
                  <p className="text-sm text-foreground text-center font-semibold leading-tight">
                    {player.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function SquadSection() {
  return (
    <SectionWrapper sectionKey="squad">
      <SquadSectionContent />
    </SectionWrapper>
  );
}
