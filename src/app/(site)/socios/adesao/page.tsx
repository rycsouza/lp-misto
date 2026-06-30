export const dynamic = "force-dynamic";

import { getPublicMembershipPlans, getActiveGatewayInfo } from "@/app/actions/membership";
import { getSiteConfig } from "@/lib/config";
import { AdesaoWizard } from "@/components/membership/AdesaoWizard";
import type { Metadata } from "next";

interface PageProps {
  searchParams: Promise<{ plano?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const brand = config.tagline || config.siteName;
  return {
    title: config.siteName ? `Seja Sócio-Torcedor — ${config.siteName}` : "Seja Sócio-Torcedor",
    description: `Escolha seu plano e faça parte${brand ? ` da família ${brand}` : " do clube"}.`,
  };
}

export default async function AdesaoPage({ searchParams }: PageProps) {
  const { plano } = await searchParams;
  const [plans, gatewayInfo, config] = await Promise.all([
    getPublicMembershipPlans().catch(() => [] as Awaited<ReturnType<typeof getPublicMembershipPlans>>),
    getActiveGatewayInfo().catch(() => null),
    getSiteConfig(),
  ]);
  const supportTarget = config.tagline || config.siteName || "nosso clube";

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
          Apoie {supportTarget} e tenha acesso a benefícios exclusivos.
        </p>
        <AdesaoWizard
          plans={plans}
          initialPlanSlug={plano}
          gatewaySlug={gatewayInfo?.slug ?? null}
          mpPublicKey={gatewayInfo?.publicKey ?? null}
        />
      </div>
    </main>
  );
}
