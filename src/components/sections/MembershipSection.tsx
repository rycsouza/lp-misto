import SectionWrapper from "@/components/ui/section-wrapper";
import { getActiveGatewayInfo, getPublicMembershipPlans } from "@/app/actions/membership";
import { promoAppliesToGateway } from "@/lib/membership/promo";
import { getSectionEnabled, getSiteConfig } from "@/lib/config";
import { PlanCard, publicPlanToCardData } from "@/components/membership/PlanCard";
import { WallCarousel } from "@/components/membership/WallCarousel";
import { getHomeWallView, type WallView } from "@/lib/membership/wall";
import { withClubColorFallback, wallCounterText } from "@/lib/membership/wall-tier";
import Link from "next/link";

/**
 * Mural dos sócios na home (toggle `section.member_wall.enabled`, padrão ligado). Sem sócio no
 * mural, ou se a leitura falhar, devolve null: a seção segue só com os planos.
 */
async function loadHomeWall(): Promise<WallView | null> {
  if (!(await getSectionEnabled("member_wall"))) return null;
  try {
    const wall = await getHomeWallView();
    return wall.cards.length > 0 ? wall : null;
  } catch (err) {
    // Só o nome do erro: a mensagem pode trazer detalhe interno.
    console.error("[home] mural dos sócios indisponível:", err instanceof Error ? err.name : "erro");
    return null;
  }
}

/** Bloco compacto do mural, acima dos planos. Só renderiza com pelo menos um sócio. */
function MemberWallBlock({ wall, brand, primaryColor }: { wall: WallView; brand: string; primaryColor: string | null }) {
  return (
    <div className="mb-12">
      <div className="text-center mb-5">
        <h3 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">Quem já é sócio</h3>
        <p className="text-sm font-semibold text-primary mt-1">{wallCounterText(wall.total)}</p>
      </div>
      <WallCarousel label={`Sócios de ${brand}`} cards={withClubColorFallback(wall.cards, primaryColor)} />
      <p className="text-center text-sm mt-5">
        <Link href="/socios/mural" className="text-primary underline underline-offset-2 hover:opacity-80">
          Ver mural completo
        </Link>
      </p>
    </div>
  );
}

export async function MembershipSectionContent() {
  const [plans, config, gateway, wall] = await Promise.all([
    getPublicMembershipPlans(),
    getSiteConfig(),
    getActiveGatewayInfo(),
    loadHomeWall(),
  ]);
  // Sem planos no banco a seção não aparece (nada de planos de exemplo na vitrine).
  if (plans.length === 0) return null;

  // "1º mês grátis" só existe no cartão Asaas: sem ele, o selo não aparece.
  const promoHere = promoAppliesToGateway(gateway?.slug);
  const brandName = config.tagline || config.siteName;
  const supportTarget = brandName || "nosso clube";
  const wallBrand = config.tagline || config.siteName || "nosso clube";

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

        {/* Mural acima dos planos (mesma seção: some junto com ela). */}
        {wall && <MemberWallBlock wall={wall} brand={wallBrand} primaryColor={config.primaryColor} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 pt-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={{ ...publicPlanToCardData(plan), promoFirstMonthFree: promoHere && plan.promoFirstMonthFree }}
              interactive
              footer={
                <Link
                  href={`/socios/adesao?plano=${plan.slug}`}
                  className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-[opacity,filter,background-color,box-shadow] duration-200 ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90 group-hover:brightness-110 group-focus-within:brightness-110 group-hover:shadow-[0_6px_18px_-6px_var(--plan-glow,rgba(193,154,90,0.6))]"
                      : "border border-primary text-primary hover:bg-primary/10 group-hover:bg-primary/10 group-focus-within:bg-primary/10"
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
        <p className="text-center text-sm text-muted-foreground mt-2">
          Quer ver quem já é sócio?{" "}
          <Link href="/socios/mural" className="text-primary underline underline-offset-2 hover:opacity-80">
            Veja o Mural dos Sócios
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
