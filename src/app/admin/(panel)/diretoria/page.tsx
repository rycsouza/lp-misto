export const dynamic = "force-dynamic";

import { getAdminBoardMembers } from "@/app/actions/admin-institutional";
import { DraggableBoardTable } from "@/components/admin/DraggableBoardTable";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function DiretoriaPage() {
  const members = await getAdminBoardMembers();

  const executive = members.filter((m) => m.group === "executive");
  const fiscal = members.filter((m) => m.group === "fiscal");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">DIRETORIA</h2>
        <Link
          href="/admin/diretoria/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Membro
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Executiva</h3>
        <DraggableBoardTable members={executive} groupKey="executive" />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Conselho Fiscal</h3>
        <DraggableBoardTable members={fiscal} groupKey="fiscal" />
      </section>
    </div>
  );
}
