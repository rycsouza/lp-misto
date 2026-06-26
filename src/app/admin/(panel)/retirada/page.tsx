export const dynamic = "force-dynamic";

import { getPendingPickups, getRecentPickups } from "@/app/actions/pickup";
import { PickupValidation } from "@/components/admin/PickupValidation";
import { PackageCheck } from "lucide-react";

export default async function RetiradaPage() {
  const [pending, recent] = await Promise.all([
    getPendingPickups(),
    getRecentPickups(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <PackageCheck size={24} className="text-primary" />
        <div>
          <h2 className="font-display text-xl text-foreground tracking-wide">
            VALIDAÇÃO DE RETIRADA
          </h2>
          <p className="text-sm text-muted-foreground">
            Confira o código informado pelo cliente e confirme a entrega do pedido.
          </p>
        </div>
      </div>

      <PickupValidation initialPending={pending} initialRecent={recent} />
    </div>
  );
}
