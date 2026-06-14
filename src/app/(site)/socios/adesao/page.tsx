import { getPublicMembershipPlans } from "@/app/actions/membership";
import { AdesaoWizard } from "@/components/membership/AdesaoWizard";

interface PageProps {
  searchParams: Promise<{ plano?: string }>;
}

export const metadata = {
  title: "Seja Sócio-Torcedor — Misto EC",
  description: "Escolha seu plano e faça parte da família Carcará.",
};

export default async function AdesaoPage({ searchParams }: PageProps) {
  const { plano } = await searchParams;
  const plans = await getPublicMembershipPlans();

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase text-center mb-2">
          Sócio-Torcedor
        </p>
        <h1 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-2">
          Faça Parte do Clube
        </h1>
        <p className="text-muted-foreground text-center text-sm mb-10">
          Apoie o Carcará da Fronteira e tenha acesso a benefícios exclusivos.
        </p>
        <AdesaoWizard plans={plans} initialPlanSlug={plano} />
      </div>
    </main>
  );
}
