import SectionWrapper from "@/components/ui/section-wrapper";
import { getPublicMembershipPlans } from "@/app/actions/membership";
import { getSiteConfig } from "@/lib/config";
import { PlanCard, publicPlanToCardData } from "@/components/membership/PlanCard";
import Link from "next/link";

async function MembershipSectionContent() {
  const [plans, config] = await Promise.all([
    getPublicMembershipPlans(),
    getSiteConfig(),
  ]);
  // Sem planos no banco a seção não aparece (nada de planos de exemplo na vitrine).
  if (plans.length === 0) return null;

  const brandName = config.tagline || config.siteName;
  const supportTarget = brandName || "nosso clube";

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 pt-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={publicPlanToCardData(plan)}
              footer={
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
              }
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          Já é sócio?{" "}
          <Link href="/conta?aba=socio" className="text-primary underline underline-offset-2 hover:opacity-80">
            Acesse sua carteirinha
          </Link>
        </p>
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
