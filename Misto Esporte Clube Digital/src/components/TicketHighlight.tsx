import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Ticket, Calendar, MapPin, ChevronRight } from "lucide-react";
import { HOME_GAMES, MISTO_CREST } from "@/data/homeGames";

const TicketHighlight = () => {
  const next = HOME_GAMES[0];

  return (
    <section className="pt-20 pb-6 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-lg"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
          <div className="relative flex flex-col md:flex-row items-stretch">
            <div className="flex-1 p-6 sm:p-8">
              <div className="flex items-center gap-3 text-primary font-semibold">
                <Ticket size={28} strokeWidth={2.5} className="text-primary" />
                <span className="font-display text-3xl sm:text-4xl tracking-wider uppercase leading-none">
                  Ingressos à venda
                </span>
              </div>

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <h2 className="font-display text-2xl sm:text-3xl text-foreground leading-tight">
                  Misto EC
                </h2>
                <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center p-3 shadow-md shrink-0">
                  <img
                    src={MISTO_CREST}
                    alt="Escudo do Misto Esporte Clube"
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="font-display text-3xl text-accent">x</span>
                <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center p-3 shadow-md shrink-0">
                  <img
                    src={next.opponentCrest}
                    alt={`Escudo do ${next.opponent}`}
                    width={56}
                    height={56}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl text-foreground leading-tight">
                  {next.opponent}
                </h2>
              </div>
              <p className="text-muted-foreground mt-2">{next.round} · Sul-Mato-Grossense 2026</p>

              <div className="grid sm:grid-cols-2 gap-3 mt-5 text-sm">
                <div className="flex items-start gap-2 text-foreground">
                  <Calendar size={16} className="text-primary mt-0.5" />
                  <div className="leading-tight">
                    <div>{next.dateLabel} · {next.timeLabel}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{next.weekdayLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <MapPin size={16} className="text-primary" />
                  Estádio Madrugadão
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4 mt-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Inteira</div>
                  <div className="font-display text-3xl text-primary">R$ 25,00</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Meia</div>
                  <div className="font-display text-3xl text-primary">R$ 12,50</div>
                </div>
              </div>

              <Link
                to="/compra-ingresso"
                className="inline-flex items-center gap-2 mt-6 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg hover:bg-primary/90 transition-all"
              >
                Comprar ingresso <ChevronRight size={18} />
              </Link>
            </div>
            <div className="md:w-72 bg-secondary/40 border-t md:border-t-0 md:border-l border-primary/20 p-6 flex flex-col justify-center">
              <div className="text-xs uppercase tracking-widest text-accent font-bold">Concorra a uma camisa oficial do Misto</div>
              <p className="font-display text-2xl text-foreground mt-1 leading-tight">
                + R$ 10,00 e leve um número da sorte
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Adicione no checkout e concorra a camisas oficiais do Misto.
              </p>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TicketHighlight;
