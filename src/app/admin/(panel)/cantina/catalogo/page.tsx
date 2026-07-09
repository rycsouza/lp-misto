export const dynamic = "force-dynamic";

import { listCantinaItemsAdmin, getCantinaConfigForAdmin } from "@/app/actions/cantina";
import { CantinaCatalogAdmin } from "@/components/cantina/CantinaCatalogAdmin";

export default async function CantinaCatalogoPage() {
  const [items, config] = await Promise.all([listCantinaItemsAdmin(), getCantinaConfigForAdmin()]);

  return (
    <div className="p-4 sm:p-6">
      <CantinaCatalogAdmin initialItems={items} initialConfig={config} />
    </div>
  );
}
