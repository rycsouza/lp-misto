export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import { getWallView } from "@/lib/membership/wall";
import { WallCarousel } from "@/components/membership/WallCarousel";
import { wallCounterText, withClubColorFallback } from "@/lib/membership/wall-tier";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: config.siteName ? `Mural dos Sócios — ${config.siteName}` : "Mural dos Sócios",
    description: "Os sócios-torcedores que escolheram aparecer no mural.",
    // Nomes de pessoas: fora dos buscadores.
    robots: { index: false, follow: false },
  };
}

/**
 * Mural dos Sócios (público, opt-in). Um carrossel só, com todos os planos misturados.
 * Mostra só a foto (quando enviada), o nome que o sócio escolheu, o plano e a data de
 * adesão, e só de quem tem benefício vigente.
 */
export default async function MuralSociosPage() {
  const [config, wall] = await Promise.all([getSiteConfig(), getWallView()]);
  const brand = config.tagline || config.siteName || "nosso clube";

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase text-center mb-2">
          Sócio-Torcedor
        </p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl sm:text-5xl text-center text-foreground mb-2">
          Mural dos Sócios
        </h1>
        {/* Contador real: o N é o total de sócios no mural (o mesmo que aparece nos tiles). */}
        <p className="font-[family-name:var(--font-bebas-neue)] text-5xl sm:text-6xl text-center text-primary leading-none mb-2">
          {wall.total > 0 ? wallCounterText(wall.total) : `Ainda não há sócios no mural de ${brand}`}
        </p>
        <p className="text-muted-foreground text-center text-xs mb-5 max-w-md mx-auto">
          Aqui aparecem só a foto (quando o sócio enviou uma), o primeiro nome com a inicial do sobrenome, o plano e a data em que cada sócio se tornou sócio, dos que escolheram estar no mural.
        </p>
        <div className="flex justify-center mb-10">
          <Link
            href="/socios/adesao"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Quero estar aqui → Seja sócio
          </Link>
        </div>

        {wall.cards.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Seja o primeiro a aparecer por aqui.</p>
          </div>
        ) : (
          <WallCarousel label={`Sócios de ${brand}`} cards={withClubColorFallback(wall.cards, config.primaryColor)} />
        )}

        {wall.truncated && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            Mostrando os primeiros nomes do mural.
          </p>
        )}

        <div className="mt-14 bg-card border border-border rounded-2xl p-6 text-center flex flex-col items-center gap-3">
          <p className="text-foreground font-semibold">Quer estar aqui?</p>
          <Link
            href="/socios/adesao"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Seja sócio →
          </Link>
          <p className="text-xs text-muted-foreground">
            Já é sócio?{" "}
            <Link href="/conta?aba=socio" className="text-primary underline underline-offset-2">
              Escolha seu nome na sua conta
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
