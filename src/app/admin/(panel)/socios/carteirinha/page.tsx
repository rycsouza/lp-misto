export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAdminMembershipPlans } from "@/app/actions/admin-growth";
import { getSiteConfig } from "@/lib/config";
import {
  normalizeCardBackgroundBlend,
  normalizeCardBackgroundFit,
  normalizeCardBackgroundOpacity,
  parseMemberCardBackground,
} from "@/lib/membership/card-background";
import { MemberCardBackgroundForm } from "@/components/admin/MemberCardBackgroundForm";

/** Visual da carteirinha: fundo do clube (vale para todos os planos). Guarda: módulo socios. */
export default async function VisualCarteirinhaPage() {
  const uploadCloudName = process.env.CLOUDINARY_CLOUD_NAME ?? null;
  const [plans, config] = await Promise.all([getAdminMembershipPlans(), getSiteConfig()]);
  const current = parseMemberCardBackground(
    {
      url: config.memberCardBackgroundUrl,
      fit: config.memberCardBackgroundFit,
      opacity: config.memberCardBackgroundOpacity,
      blend: config.memberCardBackgroundBlend,
    },
    uploadCloudName,
  );

  const activePlans = plans
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: p.name, cardColor: p.cardColor }));

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
        <h2 className="font-display text-xl text-foreground tracking-wide">VISUAL DA CARTEIRINHA</h2>
        <p className="text-sm text-muted-foreground">
          Imagem de fundo da carteirinha do clube. Vale para todos os planos; a cor de cada plano continua por trás.
        </p>
      </div>

      <MemberCardBackgroundForm
        initial={{
          url: current?.url ?? "",
          fit: normalizeCardBackgroundFit(config.memberCardBackgroundFit),
          opacity: normalizeCardBackgroundOpacity(config.memberCardBackgroundOpacity),
          blend: normalizeCardBackgroundBlend(config.memberCardBackgroundBlend),
        }}
        plans={activePlans}
        clubColor={config.primaryColor || null}
        siteName={config.siteName}
        uploadCloudName={uploadCloudName}
      />
    </div>
  );
}
