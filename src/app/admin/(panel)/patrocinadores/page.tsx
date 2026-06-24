export const dynamic = "force-dynamic";

import { getAdminSponsors } from "@/app/actions/admin-content";
import { DraggableSponsorTable } from "@/components/admin/DraggableSponsorTable";
import Link from "next/link";
import { Plus } from "lucide-react";

const tierConfig: Record<string, { label: string; className: string }> = {
  diamante: { label: "Diamante", className: "bg-cyan-500/15 text-cyan-600" },
  ouro: { label: "Ouro", className: "bg-yellow-500/15 text-yellow-600" },
  prata: { label: "Prata", className: "bg-slate-400/15 text-slate-500" },
  bronze: { label: "Bronze", className: "bg-orange-700/15 text-orange-800" },
};

const tierOrder = ["diamante", "ouro", "prata", "bronze"];

export default async function PatrocinadoresPage() {
  const sponsors = await getAdminSponsors();

  const grouped = tierOrder.reduce<Record<string, typeof sponsors>>(
    (acc, tier) => {
      acc[tier] = sponsors.filter((s) => s.tier === tier);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">PATROCINADORES</h2>
        <Link
          href="/admin/patrocinadores/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Patrocinador
        </Link>
      </div>

      {sponsors.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          Nenhum patrocinador cadastrado
        </div>
      )}

      {tierOrder.map((tier) => {
        const items = grouped[tier];
        if (!items || items.length === 0) return null;
        const cfg = tierConfig[tier];

        return (
          <div key={tier} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${cfg.className}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                ({items.length} patrocinador{items.length !== 1 ? "es" : ""})
              </span>
            </div>
            <DraggableSponsorTable sponsors={items} tier={tier} />
          </div>
        );
      })}
    </div>
  );
}
