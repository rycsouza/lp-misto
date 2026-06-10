import { Link, useLocation } from "react-router-dom";
import { Ticket, Shirt } from "lucide-react";

const SHIRT_WHATSAPP_URL =
  "https://wa.me/5567991360075?text=" +
  encodeURIComponent("Olá! Quero comprar uma camisa oficial do Misto Esporte Clube.");

const MobileStickyCTA = () => {
  const { pathname } = useLocation();
  // Não exibir na própria página de compra de ingresso (evita ruído com o checkout)
  if (pathname.startsWith("/compra-ingresso")) return null;

  return (
    <>
      {/* Spacer para evitar que o conteúdo fique escondido atrás da barra */}
      <div className="md:hidden h-20" aria-hidden="true" />

      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-misto-black/95 backdrop-blur-md border border-white/10 p-2 shadow-2xl">
          <Link
            to="/compra-ingresso"
            className="flex items-center justify-center gap-2 bg-orange text-white font-bold text-sm py-3 rounded-xl hover:bg-orange-dark active:scale-[0.98] transition-all"
            aria-label="Comprar ingresso"
          >
            <Ticket size={18} strokeWidth={2.5} />
            Ingresso
          </Link>
          <a
            href={SHIRT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm py-3 rounded-xl hover:bg-gold-dark active:scale-[0.98] transition-all"
            aria-label="Comprar camisa oficial"
          >
            <Shirt size={18} strokeWidth={2.5} />
            Camisa
          </a>
        </div>
      </div>
    </>
  );
};

export default MobileStickyCTA;
