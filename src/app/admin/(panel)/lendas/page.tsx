export const dynamic = "force-dynamic";

import { getAdminLegends } from "@/app/actions/admin-institutional";
import { DraggableLendasTable } from "@/components/admin/DraggableLendasTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function LendasPage() {
  const legends = await getAdminLegends();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">LENDAS</h2>
        <Link
          href="/admin/lendas/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova Lenda
        </Link>
      </div>

      <DraggableLendasTable legends={legends} />
    </div>
  );
}
