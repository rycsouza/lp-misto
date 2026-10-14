export const dynamic = "force-dynamic";

import { getAdminBenefits, getAdminMembershipPlans } from "@/app/actions/admin-growth";
import { BenefitMatrix } from "@/components/admin/BenefitMatrix";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function BeneficiosPlanosPage() {
  const [plans, benefits] = await Promise.all([getAdminMembershipPlans(), getAdminBenefits()]);
  const activePlans = plans.filter((p) => p.active);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/socios?tab=planos"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para sócio-torcedor
      </Link>

      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl text-foreground tracking-wide">BENEFÍCIOS DOS PLANOS</h2>
        <p className="text-sm text-muted-foreground">
          Marque o que cada plano inclui. Use o detalhe para o valor específico (ex.: &quot;3 segundos&quot;).
        </p>
      </div>

      {activePlans.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          Nenhum plano ativo. Ative um plano para editar os benefícios dele aqui.
        </div>
      ) : (
        <BenefitMatrix plans={activePlans} benefits={benefits} />
      )}
    </div>
  );
}
