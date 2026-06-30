import SectionWrapper from "@/components/ui/section-wrapper";
import { getPublicMembershipPlans } from "@/app/actions/membership";
import { getSiteConfig } from "@/lib/config";
import { Check } from "lucide-react";
import Link from "next/link";

async function MembershipSectionContent() {
  const [plans, config] = await Promise.all([
    getPublicMembershipPlans(),
    getSiteConfig(),
  ]);
  const brandName = config.tagline || config.siteName;
  const supportTarget = brandName || "nosso clube";
  const premiumPlanName = config.siteName || "Premium";

  // Fallback hardcoded plans if DB has no plans yet
  const displayPlans =
    plans.length > 0
      ? plans
      : [
          {
            id: "raiz",
            slug: "raiz",
            name: "Raiz",
            icon: "Heart",
            description: null,
            priceCents: 990,
            ticketDiscountPct: 0,
            productDiscountPct: 0,
            highlight: false,
            benefits: [
              { id: "1", label: "Carteirinha digital", order: 0 },
              { id: "2", label: "Newsletter exclusiva", order: 1 },
            ],
          },
          {
            id: "torcedor",
            slug: "torcedor",
            name: "Torcedor",
            icon: "Star",
            description: null,
            priceCents: 1990,
            ticketDiscountPct: 0,
            productDiscountPct: 10,
            highlight: false,
            benefits: [
              { id: "1", label: "Carteirinha digital", order: 0 },
              { id: "2", label: "Newsletter exclusiva", order: 1 },
              { id: "3", label: "10% de desconto em produtos", order: 2 },
            ],
          },
          {
            id: "carcara",
            slug: "carcara",
            name: premiumPlanName,
            icon: "Shield",
            description: null,
            priceCents: 3990,
            ticketDiscountPct: 15,
            productDiscountPct: 15,
            highlight: true,
            benefits: [
              { id: "1", label: "Carteirinha digital", order: 0 },
              { id: "2", label: "Newsletter exclusiva", order: 1 },
              { id: "3", label: "15% de desconto em produtos", order: 2 },
              { id: "4", label: "15% de desconto em ingressos", order: 3 },
              { id: "5", label: "Prioridade em filas", order: 4 },
            ],
          },
          {
            id: "elite",
            slug: "elite",
            name: "Elite",
            icon: "Trophy",
            description: null,
            priceCents: 7990,
            ticketDiscountPct: 20,
            productDiscountPct: 20,
            highlight: false,
            benefits: [
              { id: "1", label: "Carteirinha digital", order: 0 },
              { id: "2", label: "Newsletter exclusiva", order: 1 },
              { id: "3", label: "20% de desconto em produtos", order: 2 },
              { id: "4", label: "20% de desconto em ingressos", order: 3 },
              { id: "5", label: "Prioridade em filas", order: 4 },
              { id: "6", label: "Camarote em jogos selecionados", order: 5 },
              { id: "7", label: "Kit sócio anual", order: 6 },
            ],
          },
        ];

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
          Apoie {supportTarget} e tenha acesso a benefícios exclusivos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayPlans.map((plan) => (
            <div
              key={plan.id}
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
                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                )}
                <p className="text-primary font-bold text-xl mt-1">
                  {(plan.priceCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">por mês</p>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.benefits.map((benefit) => (
                  <li
                    key={benefit.id}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <Check size={14} className="text-primary mt-0.5 shrink-0" />
                    {benefit.label}
                  </li>
                ))}
              </ul>
              <Link
                href={`/socios/adesao?plano=${plan.slug}`}
                className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-primary text-primary hover:bg-primary/10"
                }`}
              >
                Assinar agora
              </Link>
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
