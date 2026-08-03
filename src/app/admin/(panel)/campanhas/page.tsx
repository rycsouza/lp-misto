export const dynamic = "force-dynamic";

import { getCampaignProducts } from "@/app/actions/campaigns";
import { CampaignComposer } from "@/components/admin/CampaignComposer";
import { Mail } from "lucide-react";
import { notFound } from "next/navigation";
import { CAMPAIGNS_ENABLED } from "@/lib/product-flags";

export default async function CampanhasPage() {
  if (!CAMPAIGNS_ENABLED) notFound(); // Campanhas escondida (ver @/lib/product-flags).
  const products = await getCampaignProducts();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Mail size={24} className="text-primary" />
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">
            CAMPANHAS DE E-MAIL
          </h2>
          <p className="text-sm text-muted-foreground">
            Filtre os pedidos por produto, selecione os destinatários e envie um comunicado.
          </p>
        </div>
      </div>

      <CampaignComposer products={products} />
    </div>
  );
}
