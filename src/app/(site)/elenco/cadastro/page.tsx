export const dynamic = "force-dynamic";

import { getAthleteInviteCode } from "@/app/actions/athletes";
import { AthleteApplicationForm } from "@/components/elenco/AthleteApplicationForm";

export const metadata = {
  title: "Cadastro de Atleta — Misto EC",
  description: "Formulário de cadastro para atletas do Misto Esporte Clube.",
};

export default async function AthleteCadastroPage() {
  const inviteCode = await getAthleteInviteCode();

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase text-center mb-2">
          Misto Esporte Clube
        </p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-2">
          Ficha de Cadastro — Atleta
        </h1>
        <p className="text-muted-foreground text-center text-sm mb-10">
          Preencha todos os dados abaixo para se candidatar ao elenco do Carcará da Fronteira.
        </p>
        <AthleteApplicationForm hasInviteCode={!!inviteCode} />
      </div>
    </main>
  );
}
