export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { CANTINA_ENABLED } from "@/lib/cantina/flag";
import { listCantinaItemsAdmin, getCantinaConfigForAdmin } from "@/app/actions/cantina";
import { CantinaCatalogAdmin } from "@/components/cantina/CantinaCatalogAdmin";

export default async function CantinaCatalogoPage() {
  if (!CANTINA_ENABLED) notFound();
  const [items, config] = await Promise.all([listCantinaItemsAdmin(), getCantinaConfigForAdmin()]);

  return (
    <div className="p-4 sm:p-6">
      <CantinaCatalogAdmin initialItems={items} initialConfig={config} />
    </div>
  );
}
