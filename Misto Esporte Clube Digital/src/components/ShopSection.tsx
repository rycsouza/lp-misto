import { motion } from "framer-motion";
import { MessageCircle, ImageOff, ShoppingBag } from "lucide-react";
import camisaPreta from "@/assets/shop/camisa-torcedor-preta.jpg.asset.json";
import camisaBranca from "@/assets/shop/camisa-torcedor-branca.jpg.asset.json";
import camisaRosa from "@/assets/shop/camisa-torcedor-rosa.jpg.asset.json";

const WHATSAPP_NUMBER = "5567991360075";

type Product = {
  name: string;
  price: number;
  category: "Camisa Oficial" | "Camisa Torcedor" | "Ingressos";
  image?: string;
};

const products: Product[] = [
  { name: "Camisa Oficial Preta", price: 199, category: "Camisa Oficial" },
  { name: "Camisa Oficial Branca", price: 199, category: "Camisa Oficial" },
  { name: "Camisa de Torcedor Preta", price: 109, category: "Camisa Torcedor", image: camisaPreta.url },
  { name: "Camisa de Torcedor Branca", price: 109, category: "Camisa Torcedor", image: camisaBranca.url },
  { name: "Camisa de Torcedor Rosa", price: 109, category: "Camisa Torcedor", image: camisaRosa.url },
  { name: "Ingresso para um jogo", price: 30, category: "Ingressos" },
  { name: "Ingresso para os três jogos", price: 90, category: "Ingressos" },
  { name: "Ingresso para Jogo (meia entrada)", price: 15, category: "Ingressos" },
];

const formatPrice = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ShopSection = () => (
  <section id="loja" className="py-20 sm:py-28 bg-background">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 text-primary mb-3">
          <ShoppingBag size={20} />
          <span className="text-xs uppercase tracking-widest font-bold">Loja do Carcará</span>
        </div>
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">
          CAMISAS & INGRESSOS
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Vista as cores do Misto e garanta seu lugar no Madrugadão. Compras direto pelo WhatsApp.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {products.map((p, i) => {
          const msg = `Olá! Tenho interesse em comprar: ${p.name} — ${formatPrice(p.price)}.`;
          const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="group bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-primary/60 transition-all"
            >
              <div className="aspect-[3/4] bg-secondary/40 relative overflow-hidden">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-2">
                    <ImageOff size={36} strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-widest">Imagem em breve</span>
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-misto-black/80 text-primary text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md backdrop-blur">
                  {p.category}
                </span>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-display text-base sm:text-lg tracking-wider text-foreground leading-tight">
                  {p.name}
                </h3>
                <div className="mt-2 mb-4">
                  <span className="font-display text-2xl text-primary">{formatPrice(p.price)}</span>
                </div>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-xs sm:text-sm py-2.5 px-3 rounded-lg hover:bg-primary/90 transition-all"
                >
                  <MessageCircle size={14} />
                  Comprar
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default ShopSection;
