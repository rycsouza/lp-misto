import { motion } from "framer-motion";
import { Construction, ClipboardList } from "lucide-react";

const SquadSection = () => (
  <section id="elenco" className="py-20 sm:py-28 bg-card/50">
    <div className="container mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">ELENCO 2026</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Conheça os guerreiros que vestem a camisa alvinegra.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto bg-card border border-primary/30 rounded-2xl p-8 sm:p-12 text-center"
      >
        <Construction size={48} className="text-primary mx-auto mb-4" />
        <h3 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground mb-3">
          MONTAGEM DO ELENCO
        </h3>
        <p className="text-muted-foreground text-base sm:text-lg">
          Estamos em processo de montagem do time para a temporada 2026. Em breve, apresentaremos nossos atletas e comissão técnica.
        </p>
        <div className="mt-6 inline-block bg-primary/10 text-primary font-bold text-sm px-5 py-2 rounded-full">
          🚧 Em breve
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 }}
        className="max-w-2xl mx-auto bg-card border border-primary/30 rounded-2xl p-8 sm:p-12 text-center mt-8"
      >
        <ClipboardList size={48} className="text-primary mx-auto mb-4" />
        <h3 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground mb-3">
          COMISSÃO TÉCNICA
        </h3>
        <p className="text-muted-foreground text-base sm:text-lg">
          Estamos em processo de contratação da comissão técnica. O técnico será definido em breve.
        </p>
        <div className="mt-6 inline-block bg-primary/10 text-primary font-bold text-sm px-5 py-2 rounded-full">
          🚧 Em definição
        </div>
      </motion.div>
    </div>
  </section>
);

export default SquadSection;
