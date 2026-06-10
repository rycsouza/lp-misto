import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

const InstagramSection = () => (
  <section id="instagram" className="py-20 sm:py-28">
    <div className="container mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">
          <Instagram size={36} className="inline text-primary mr-3" />
          INSTAGRAM
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Acompanhe o dia a dia do Misto nas redes sociais.</p>
      </motion.div>

      {/* Placeholder grid — replace with real embed later */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-card border border-border rounded-xl flex items-center justify-center group hover:border-primary transition-colors cursor-pointer">
            <Instagram size={32} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        ))}
      </div>

      <div className="text-center">
        <a
          href="https://instagram.com/misto.esporteclube"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg hover:bg-gold-dark transition-all"
        >
          <Instagram size={18} />
          Seguir @misto.esporteclube
        </a>
      </div>
    </div>
  </section>
);

export default InstagramSection;
