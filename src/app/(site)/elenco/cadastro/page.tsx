export const dynamic = "force-dynamic";

import { getAthleteInviteCode } from "@/app/actions/athletes";
import { getSiteConfig } from "@/lib/config";
import { AthleteApplicationForm } from "@/components/elenco/AthleteApplicationForm";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: config.siteName ? `Cadastro de Atleta — ${config.siteName}` : "Cadastro de Atleta",
    description: `Formulário de cadastro para atletas${config.siteName ? ` do ${config.siteName}` : ""}.`,
  };
}

export default async function AthleteCadastroPage() {
  const [inviteCode, config] = await Promise.all([
    getAthleteInviteCode(),
    getSiteConfig(),
  ]);
  const brand = config.tagline || config.siteName;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        {config.siteName && (
          <p className="text-primary text-xs font-semibold tracking-widest uppercase text-center mb-2">
            {config.siteName}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-2">
          Ficha de Cadastro — Atleta
        </h1>
        <p className="text-muted-foreground text-center text-sm mb-10">
          Preencha todos os dados abaixo para se candidatar ao elenco{brand ? ` de ${brand}` : ""}.
        </p>
        <AthleteApplicationForm hasInviteCode={!!inviteCode} siteName={config.siteName || undefined} />
      </div>
    </main>
  );
}
