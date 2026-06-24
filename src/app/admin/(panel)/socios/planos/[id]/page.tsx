export const dynamic = "force-dynamic";

import {
  getAdminMembershipPlans,
  getAdminBenefits,
} from "@/app/actions/admin-growth";
import { MembershipPlanForm } from "@/components/admin/MembershipPlanForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarPlanoPage({ params }: PageProps) {
  const { id } = await params;

  const [plans, allBenefits] = await Promise.all([
    getAdminMembershipPlans(),
    getAdminBenefits(),
  ]);

  const plan = plans.find((p) => p.id === id);
  if (!plan) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/socios"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para sócio-torcedor
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR PLANO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <MembershipPlanForm plan={plan} allBenefits={allBenefits} />
      </div>
    </div>
  );
}
