export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { CANTINA_ENABLED } from "@/lib/cantina/flag";
import { CantinaPrepPanel } from "@/components/cantina/CantinaPrepPanel";

export default function CantinaPreparoPage() {
  if (!CANTINA_ENABLED) notFound();
  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-md mx-auto">
        Retiradas que precisam de preparo. Marque <b>pronto</b> quando terminar e <b>entregar</b> ao
        repassar para o torcedor.
      </p>
      <CantinaPrepPanel />
    </div>
  );
}
