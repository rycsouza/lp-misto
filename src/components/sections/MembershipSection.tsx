import SectionWrapper from "@/components/ui/section-wrapper";
import { MembershipInterestButton } from "./MembershipModal";
import { Check } from "lucide-react";

const PLANS = [
  {
    slug: "raiz",
    name: "Raiz",
    price: "R$ 9,90",
    priceCents: 990,
    highlight: false,
    benefits: ["Carteirinha digital", "Newsletter exclusiva"],
  },
  {
    slug: "torcedor",
    name: "Torcedor",
    price: "R$ 19,90",
    priceCents: 1990,
    highlight: false,
    benefits: ["Carteirinha digital", "Newsletter exclusiva", "Desconto em produtos", "Acesso a conteúdo exclusivo"],
  },
  {
    slug: "carcara",
    name: "Carcará",
    price: "R$ 39,90",
    priceCents: 3990,
    highlight: true,
    benefits: ["Carteirinha digital", "Newsletter exclusiva", "Desconto em produtos", "Acesso a conteúdo exclusivo", "Ingresso com desconto", "Prioridade em filas"],
  },
  {
    slug: "elite",
    name: "Elite",
    price: "R$ 79,90",
    priceCents: 7990,
    highlight: false,
    benefits: ["Carteirinha digital", "Newsletter exclusiva", "Desconto em produtos", "Acesso a conteúdo exclusivo", "Ingresso com desconto", "Prioridade em filas", "Camarote em jogos selecionados", "Kit sócio anual"],
  },
  {
    slug: "empresarial",
    name: "Empresarial",
    price: "R$ 199,00",
    priceCents: 19900,
    highlight: false,
    benefits: ["Todos os benefícios Elite", "Logo da empresa no site", "Destaque em redes sociais", "Ingressos para colaboradores", "Reunião com diretoria"],
  },
];

function MembershipSectionContent() {
  return (
    <section id="socio" className="py-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Faça Parte
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-3">
          Seja Sócio-Torcedor
        </h2>
        <p className="text-muted-foreground text-center text-sm mb-10 max-w-xl mx-auto">
          Apoie o Carcará da Fronteira e tenha acesso a benefícios exclusivos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`relative bg-card border rounded-xl p-5 flex flex-col ${
                plan.highlight
                  ? "border-primary shadow-[0_0_20px_rgba(193,154,90,0.3)]"
                  : "border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MAIS POPULAR
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground">
                  {plan.name}
                </h3>
                <p className="text-primary font-bold text-xl">{plan.price}</p>
                <p className="text-xs text-muted-foreground">por mês</p>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check size={14} className="text-primary mt-0.5 shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <MembershipInterestButton plan={{ slug: plan.slug, name: plan.name, price: plan.price }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function MembershipSection() {
  return (
    <SectionWrapper sectionKey="membership">
      <MembershipSectionContent />
    </SectionWrapper>
  );
}
