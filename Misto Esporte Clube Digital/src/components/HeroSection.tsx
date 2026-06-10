import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronRight } from "lucide-react";
import heroPlayer from "@/assets/hero-player.jpg";


const TARGET_DATE = new Date("2026-06-22T16:00:00");

const useCountdown = (target: Date) => {
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};

const CountdownBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="font-display text-4xl sm:text-5xl text-primary animate-count-pulse">{String(value).padStart(2, "0")}</span>
    <span className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">{label}</span>
  </div>
);

const HeroSection = () => {
  const countdown = useCountdown(TARGET_DATE);

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Background with overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(51_100%_50%/0.05),transparent_70%)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center text-left max-w-6xl mx-auto"
        >
          {/* Player image */}
          <div className="order-2 lg:order-1 relative">
            <div className="relative aspect-[4/5] w-full max-w-md mx-auto overflow-hidden rounded-3xl border border-primary/30 shadow-2xl">
              <img
                src={heroPlayer}
                alt="Jogador do Misto Esporte Clube olhando para o campo"
                width={1024}
                height={1280}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
            </div>
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_70%)]" />
          </div>

          {/* Headline */}
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-8">
              <Calendar size={16} />
              Campeonato Sul-Mato-Grossense 2026
            </span>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl tracking-wider text-foreground leading-[0.95] mb-6">
              CARCARÁ <span className="text-primary">DA FRONTEIRA</span>
            </h1>

            <p className="font-sans text-lg sm:text-xl text-foreground/90 max-w-xl lg:mx-0 mx-auto mb-8 leading-relaxed italic">
              "Uma tradição, uma torcida e um olhar pra frente."
            </p>

            <p className="font-sans text-base text-muted-foreground max-w-xl lg:mx-0 mx-auto mb-10 leading-relaxed">
              Desde 1993, representando Três Lagoas com garra e paixão. O Misto Esporte Clube estreia no Campeonato Sul-Mato-Grossense 2026 no dia 22 de junho, contra o EC Taveirópolis.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <a
                href="#socio"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-4 rounded-lg hover:bg-gold-dark transition-all gold-glow text-base"
              >
                Seja Sócio Torcedor
                <ChevronRight size={18} />
              </a>
              <a
                href="#patrocinadores"
                className="inline-flex items-center gap-2 border-2 border-primary text-primary font-bold px-8 py-4 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all text-base"
              >
                Patrocine o Misto
              </a>
            </div>
          </div>
        </motion.div>


        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-12"
        >
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-6 mt-12 text-center">22/06 — Misto EC vs EC Taveirópolis · Campo Grande/MS</p>
          <div className="flex items-center justify-center gap-6 sm:gap-10">

            <CountdownBlock value={countdown.days} label="Dias" />
            <span className="text-2xl text-muted-foreground font-display">:</span>
            <CountdownBlock value={countdown.hours} label="Horas" />
            <span className="text-2xl text-muted-foreground font-display">:</span>
            <CountdownBlock value={countdown.minutes} label="Min" />
            <span className="text-2xl text-muted-foreground font-display">:</span>
            <CountdownBlock value={countdown.seconds} label="Seg" />
          </div>
        </motion.div>

        {/* Expectation block */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="max-w-3xl mx-auto bg-card border border-border rounded-2xl p-6 sm:p-8"
        >
          <h2 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground mb-3">
            O MISTO VEM COM TUDO EM 2026
          </h2>
          <p className="font-sans text-muted-foreground leading-relaxed">
            Com elenco renovado e uma diretoria comprometida, o Misto Esporte Clube 
            entra em campo no Campeonato Sul-Mato-Grossense 2026 com a missão de 
            conquistar o acesso à Série A. Cada jogo é uma oportunidade de mostrar 
            a força da nossa torcida e levar Três Lagoas ao topo do futebol estadual.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
