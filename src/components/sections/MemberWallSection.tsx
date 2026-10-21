import SectionWrapper, { type SectionLabelProps } from "@/components/ui/section-wrapper";
import { WallCarousel } from "@/components/membership/WallCarousel";
import { getSiteConfig } from "@/lib/config";
import { getHomeWallView, type WallView } from "@/lib/membership/wall";
import { withClubColorFallback, wallCounterText } from "@/lib/membership/wall-tier";
import Link from "next/link";

/**
 * Mural dos sócios na home: seção própria, ordenável na aba Seções (chave `member_wall`, padrão
 * ligada, logo antes da seção de sócio). Sem sócio no mural, ou se a leitura falhar, não renderiza
 * (a home segue sem ele). Some também quando o módulo de sócios está desligado pelo kill-switch
 * (ver FEATURES em src/lib/platform/features.ts).
 */
async function loadHomeWall(): Promise<WallView | null> {
  try {
    const wall = await getHomeWallView();
    return wall.cards.length > 0 ? wall : null;
  } catch (err) {
    // Só o nome do erro: a mensagem pode trazer detalhe interno.
    console.error("[home] mural dos sócios indisponível:", err instanceof Error ? err.name : "erro");
    return null;
  }
}

export async function MemberWallContent({ label }: SectionLabelProps = {}) {
  const [config, wall] = await Promise.all([getSiteConfig(), loadHomeWall()]);
  if (!wall) return null;

  const brand = config.tagline || config.siteName || "nosso clube";

  return (
    <section id="mural" className="py-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-5">
          <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-foreground">
            {label ?? "Quem já é sócio"}
          </h2>
          <p className="text-sm font-semibold text-primary mt-1">{wallCounterText(wall.total)}</p>
        </div>
        <WallCarousel label={`Sócios de ${brand}`} cards={withClubColorFallback(wall.cards, config.primaryColor)} />
        <p className="text-center text-sm mt-5">
          <Link href="/socios/mural" className="text-primary underline underline-offset-2 hover:opacity-80">
            Ver mural completo
          </Link>
        </p>
      </div>
    </section>
  );
}

export default async function MemberWallSection({ label }: SectionLabelProps = {}) {
  return (
    <SectionWrapper sectionKey="member_wall">
      <MemberWallContent label={label} />
    </SectionWrapper>
  );
}
