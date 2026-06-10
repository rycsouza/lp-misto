import { motion } from "framer-motion";
import { Handshake } from "lucide-react";
import sicrediLogo from "@/assets/sponsors/sicredi.png.asset.json";
import novaEstrelaLogo from "@/assets/sponsors/nova-estrela.png.asset.json";
import concreluzLogo from "@/assets/sponsors/concreluz.png.asset.json";
import unoparLogo from "@/assets/sponsors/unopar.png.asset.json";
import daikinLogo from "@/assets/sponsors/daikin.png.asset.json";

type Tier = "diamante" | "ouro" | "prata" | "bronze";

type Sponsor = {
  name: string;
  instagram: string;
  logo: string;
  logoTone: "light" | "dark";
  tier: Tier;
};

const SPONSORS: Sponsor[] = [
  { name: "Sicredi", instagram: "https://www.instagram.com/p/DYr0PF4BQ2y/", logo: sicrediLogo.url, logoTone: "light", tier: "diamante" },
  { name: "Supermercado Nova Estrela", instagram: "https://www.instagram.com/p/DYryq1dOOsU/", logo: novaEstrelaLogo.url, logoTone: "light", tier: "ouro" },
  { name: "Concreluz", instagram: "https://www.instagram.com/p/DYr1SHCOm5q/", logo: concreluzLogo.url, logoTone: "dark", tier: "ouro" },
  { name: "Unopar", instagram: "https://www.instagram.com/p/DYr1bl3Pitc/", logo: unoparLogo.url, logoTone: "light", tier: "prata" },
  { name: "Daikin", instagram: "https://www.instagram.com/p/DYr1n84P71v/", logo: daikinLogo.url, logoTone: "light", tier: "prata" },
];

// Frequência por nível (quanto maior a relevância, mais vezes aparece no backdrop)
const TIER_FREQUENCY: Record<Tier, number> = {
  diamante: 4,
  ouro: 3,
  prata: 2,
  bronze: 1,
};

// Tamanho da logo dentro do backdrop por nível
const TIER_LOGO_SIZE: Record<Tier, string> = {
  diamante: "h-20 sm:h-28",
  ouro: "h-16 sm:h-20",
  prata: "h-12 sm:h-16",
  bronze: "h-10 sm:h-12",
};

const buildBackdropList = (): Sponsor[] => {
  // Expande conforme a frequência, depois embaralha mantendo a ordem de relevância visual.
  const expanded: Sponsor[] = [];
  SPONSORS.forEach((sp) => {
    for (let i = 0; i < TIER_FREQUENCY[sp.tier]; i++) expanded.push(sp);
  });
  // Intercala para não deixar marcas iguais coladas
  const interleaved: Sponsor[] = [];
  const buckets: Sponsor[][] = SPONSORS.map((sp) =>
    expanded.filter((e) => e.name === sp.name)
  );
  while (buckets.some((b) => b.length > 0)) {
    buckets.forEach((b) => {
      const item = b.shift();
      if (item) interleaved.push(item);
    });
  }
  return interleaved;
};

const BACKDROP_ROW = buildBackdropList();

const SponsorTile = ({ sponsor }: { sponsor: Sponsor }) => {
  const bg = sponsor.logoTone === "light" ? "bg-misto-black" : "bg-white";
  return (
    <a
      href={sponsor.instagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={sponsor.name}
      className={`shrink-0 flex items-center justify-center ${bg} border border-border/60 rounded-xl px-6 sm:px-8 py-5 sm:py-6 mx-2 hover:border-primary transition-colors`}
    >
      <img
        src={sponsor.logo}
        alt={`Logo ${sponsor.name}`}
        loading="lazy"
        className={`${TIER_LOGO_SIZE[sponsor.tier]} w-auto object-contain`}
      />
    </a>
  );
};

const MarqueeRow = ({
  items,
  direction = "left",
  duration = 40,
}: {
  items: Sponsor[];
  direction?: "left" | "right";
  duration?: number;
}) => {
  // Duplica a lista para criar loop contínuo
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden">
      <div
        className="flex items-center w-max"
        style={{
          animation: `marquee-${direction} ${duration}s linear infinite`,
        }}
      >
        {loop.map((sp, idx) => (
          <SponsorTile key={`${sp.name}-${idx}`} sponsor={sp} />
        ))}
      </div>
    </div>
  );
};

const SponsorsSection = () => {
  return (
    <section id="patrocinadores" className="py-20 sm:py-28 bg-card/50">
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">
            PATROCINADORES
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Organizações que acreditam no Misto e investem no esporte.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-7xl mx-auto rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-sm py-8 sm:py-10 space-y-4 overflow-hidden"
        >
          {/* fade lateral */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-card/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-card/80 to-transparent z-10" />

          <MarqueeRow items={BACKDROP_ROW} direction="left" duration={45} />
          <MarqueeRow items={[...BACKDROP_ROW].reverse()} direction="right" duration={55} />
          <MarqueeRow items={BACKDROP_ROW} direction="left" duration={65} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto mt-14 bg-card border border-primary/30 rounded-2xl p-8 text-center"
        >
          <Handshake size={40} className="text-primary mx-auto mb-3" />
          <h3 className="font-display text-xl sm:text-2xl tracking-wider text-foreground mb-2">
            SEJA UM PATROCINADOR
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Toda semana novas marcas se juntam ao Carcará. Faça parte dessa reconstrução.
          </p>
          <a
            href="https://wa.me/5567991360075"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-primary-foreground font-bold text-sm px-5 py-2 rounded-full hover:bg-primary/80 transition-all"
          >
            📩 Falar com o clube
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default SponsorsSection;
