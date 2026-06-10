import { motion } from "framer-motion";
import { Trophy, Star, Instagram, MessageCircle, User, Heart } from "lucide-react";

import arthurPhoto from "@/assets/legends/arthur.jpg";
import brunoPhoto from "@/assets/legends/bruno.png";
import celioPhoto from "@/assets/legends/celio.jpg";
import cristianoPhoto from "@/assets/legends/cristiano.png";
import julioPhoto from "@/assets/legends/julio-primavera.jpg";
import kayoPhoto from "@/assets/legends/kayo.png";
import maringaPhoto from "@/assets/legends/maringa.jpg";
import miPhoto from "@/assets/legends/mi-santaluzia.jpg";
import angeloPhoto from "@/assets/legends/angelo.png";
import diguePhoto from "@/assets/legends/digue.jpg";
import olairPhoto from "@/assets/legends/olair.png";
import joelPhoto from "@/assets/legends/joel.png";
import aryAraoPhoto from "@/assets/legends/ary-arao.png";
import nivaldoPhoto from "@/assets/legends/dr-nivaldo.png";

interface Legend {
  name: string;
  photo?: string | null;
}

interface Personality {
  name: string;
  photo?: string | null;
  role?: string;
}

interface PersonalityCategory {
  category: string;
  people: Personality[];
}

const personalities: PersonalityCategory[] = [
  {
    category: "Médicos",
    people: [
      { name: "Dr. Joel", photo: joelPhoto },
      { name: "Dr. Ari Arão", photo: aryAraoPhoto },
      { name: "Dr. Nivaldo", photo: nivaldoPhoto },
    ],
  },
  {
    category: "Dirigentes",
    people: [],
  },
  {
    category: "Técnicos",
    people: [
      { name: "Ramão" },
      { name: "Amarildo Carvalho" },
    ],
  },
  {
    category: "Voluntários",
    people: [],
  },
];

const timeline = [
  { year: "1993", title: "Fundação do Clube", desc: "Em 14 de abril de 1993, nasce o Misto Esporte Clube em Três Lagoas/MS." },
  { year: "2000", title: "Primeira Participação Estadual", desc: "O Misto estreia oficialmente no Campeonato Sul-Mato-Grossense." },
  { year: "2010", title: "Título Histórico", desc: "Conquista marcante que consolidou o clube no cenário estadual." },
  { year: "2020", title: "Reestruturação e Modernização", desc: "Nova diretoria implementa gestão profissional e investe nas categorias de base." },
  { year: "2026", title: "Objetivo: Série A", desc: "Com elenco competitivo, o Misto busca o acesso à primeira divisão estadual." },
];

const legends: Legend[] = [
  { name: "Mi Santa Luzia", photo: miPhoto },
  { name: "Júlio Primavera", photo: julioPhoto },
  { name: "Crystiano", photo: cristianoPhoto },
  { name: "Olair", photo: olairPhoto },
  { name: "Maringá", photo: maringaPhoto },
  { name: "Bruno Diniz", photo: brunoPhoto },
  { name: "Célio", photo: celioPhoto },
  { name: "Arthur Hassam", photo: arthurPhoto },
  { name: "Digue", photo: diguePhoto },
  { name: "Ângelo", photo: angeloPhoto },
  { name: "Kayo", photo: kayoPhoto },
  { name: "Hodirley (Tranin)" },
  { name: "Giordan (Belisca)" },
  { name: "Jean (Vinícius)" },
  { name: "Rodrigo Goiano" },
];

const LegendCard = ({ legend }: { legend: Legend }) => (
  <div className="flex-shrink-0 w-28 sm:w-32 snap-start">
    <div className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary transition-colors h-full">
      <div className="w-14 h-14 mx-auto mb-2 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        {legend.photo ? (
          <img src={legend.photo} alt={legend.name} className="w-full h-full object-cover" />
        ) : (
          <User size={28} className="text-muted-foreground/60" />
        )}
      </div>
      <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{legend.name}</p>
    </div>
  </div>
);

const LegendsCarousel = ({ items, direction = "left" }: { items: Legend[]; direction?: "left" | "right" }) => {
  const duplicated = [...items, ...items, ...items];
  const totalWidth = items.length * 140;

  return (
    <div className="overflow-hidden relative">
      <motion.div
        className="flex gap-3"
        animate={{ x: direction === "left" ? [0, -totalWidth] : [-totalWidth, 0] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: items.length * 3,
            ease: "linear",
          },
        }}
      >
        {duplicated.map((l, i) => (
          <LegendCard key={`${l.name}-${i}`} legend={l} />
        ))}
      </motion.div>
    </div>
  );
};

const legendsRow1 = legends.slice(0, Math.ceil(legends.length / 2));
const legendsRow2 = legends.slice(Math.ceil(legends.length / 2));

const HistorySection = () => (
  <section id="historia" className="py-20 sm:py-28 bg-card/50">
    <div className="container mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">NOSSA HISTÓRIA</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Mais de 30 anos de tradição, garra e paixão pelo futebol.</p>
      </motion.div>

      {/* Timeline */}
      <div className="max-w-3xl mx-auto mb-20">
        {timeline.map((item, i) => (
          <motion.div
            key={item.year}
            initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-4 sm:gap-6 mb-8 last:mb-0"
          >
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Trophy size={18} className="text-primary-foreground" />
              </div>
              {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border mt-2" />}
            </div>
            <div className="pb-8">
              <span className="font-display text-2xl text-primary">{item.year}</span>
              <h3 className="font-display text-xl tracking-wide text-foreground mt-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legends Carousel */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
        <h3 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground text-center mb-8">
          <Star size={24} className="inline text-primary mr-2" />
          GALERIA DE EX-JOGADORES
        </h3>
        <div className="space-y-4">
          <LegendsCarousel items={legendsRow1} direction="left" />
          <LegendsCarousel items={legendsRow2} direction="right" />
        </div>

      </motion.div>

      {/* Personalities */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
        <h3 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground text-center mb-8">
          <Heart size={24} className="inline text-primary mr-2" />
          PERSONALIDADES DO MISTO
        </h3>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-8">
          Pessoas que contribuíram com o clube dentro e fora de campo.
        </p>
        <div className="max-w-3xl mx-auto space-y-8">
          {personalities.filter(cat => cat.people.length > 0).map((cat) => (
            <div key={cat.category}>
              <h4 className="font-display text-lg tracking-wider text-primary mb-4 text-center">{cat.category.toUpperCase()}</h4>
              <div className="flex flex-wrap justify-center gap-4">
                {cat.people.map((person) => (
                  <div key={person.name} className="w-28 sm:w-32">
                    <div className="bg-card border border-border rounded-xl p-3 text-center hover:border-primary transition-colors">
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {person.photo ? (
                          <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                        ) : (
                          <User size={28} className="text-muted-foreground/60" />
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{person.name}</p>
                      {person.role && <p className="text-[10px] text-muted-foreground mt-0.5">{person.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
        <div className="text-center bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
          <h4 className="font-display text-xl sm:text-2xl tracking-wider text-foreground mb-3">AJUDE A COMPLETAR NOSSA GALERIA!</h4>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm sm:text-base">
            Conhece algum ex-jogador ou personalidade que marcou história no Misto e não está aqui? Queremos prestigiar e lembrar de todos! Envie o nome e a foto pelo WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`https://wa.me/5567991360075?text=${encodeURIComponent("Olá! Gostaria de indicar um ex-jogador para a galeria do site do Misto. Nome: ")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg hover:bg-gold-dark transition-all gold-glow"
            >
              <MessageCircle size={18} />
              Indicar Ex-Jogador
            </a>
            <a
              href={`https://wa.me/5567991360075?text=${encodeURIComponent("Olá! Gostaria de indicar uma personalidade que contribuiu com o Misto para a galeria do site. Nome: ")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-primary text-primary font-bold px-6 py-3 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <Heart size={18} />
              Indicar Personalidade
            </a>
          </div>
        </div>
      </motion.div>

      <div className="text-center">
        <a
          href="https://instagram.com/mistoec"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
        >
          <Instagram size={18} />
          Ver galeria completa no Instagram
        </a>
      </div>
    </div>
  </section>
);

export default HistorySection;
