export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config";
import { getWallView } from "@/lib/membership/wall";

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
 * Mural dos Sócios (público, opt-in). Mostra só o nome que o sócio escolheu,
 * agrupado por plano, e só de quem tem benefício vigente.
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
        <p className="text-muted-foreground text-center text-sm mb-2">
          {wall.total > 0
            ? `${wall.total} ${wall.total === 1 ? "sócio" : "sócios"} no mural de ${brand}`
            : `Ainda não há sócios no mural de ${brand}`}
        </p>
        <p className="text-muted-foreground text-center text-xs mb-10 max-w-md mx-auto">
          Aqui aparecem só os nomes de sócios que escolheram estar no mural.
        </p>

        {wall.groups.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Seja o primeiro a aparecer por aqui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {wall.groups.map((group) => (
              <section key={group.planId} aria-labelledby={`plano-${group.planId}`}>
                <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 mb-4">
                  <h2
                    id={`plano-${group.planId}`}
                    className="font-[family-name:var(--font-bebas-neue)] text-2xl text-foreground tracking-wide"
                  >
                    {group.planName}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {group.names.length} {group.names.length === 1 ? "nome" : "nomes"}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {group.names.map((name, i) => (
                    <li
                      key={`${i}-${name}`}
                      className="px-3 py-1.5 rounded-full bg-card border border-border text-sm text-foreground break-words max-w-full"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
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
