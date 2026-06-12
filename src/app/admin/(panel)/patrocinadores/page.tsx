import { getAdminSponsors } from "@/app/actions/admin-content";
import { SponsorActions } from "@/components/admin/SponsorActions";
import Link from "next/link";
import { Plus } from "lucide-react";

const tierConfig: Record<
  string,
  { label: string; className: string }
> = {
  diamante: {
    label: "Diamante",
    className: "bg-cyan-500/15 text-cyan-600",
  },
  ouro: {
    label: "Ouro",
    className: "bg-yellow-500/15 text-yellow-600",
  },
  prata: {
    label: "Prata",
    className: "bg-slate-400/15 text-slate-500",
  },
  bronze: {
    label: "Bronze",
    className: "bg-orange-700/15 text-orange-800",
  },
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
        <h2 className="font-display text-xl text-foreground tracking-wide">
          PATROCINADORES
        </h2>
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
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${cfg.className}`}
              >
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                ({items.length} patrocinador{items.length !== 1 ? "es" : ""})
              </span>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Logo
                      </th>
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Nome
                      </th>
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Tier
                      </th>
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Tom
                      </th>
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Ordem
                      </th>
                      <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Ativo
                      </th>
                      <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((sponsor) => (
                      <tr
                        key={sponsor.id}
                        className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`w-12 h-8 rounded flex items-center justify-center overflow-hidden ${sponsor.logoTone === "light" ? "bg-gray-800" : "bg-gray-100"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={sponsor.logoUrl}
                              alt={sponsor.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {sponsor.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs capitalize">
                          {sponsor.logoTone}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {sponsor.order}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              sponsor.active
                                ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                                : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                            }
                          >
                            {sponsor.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <SponsorActions
                            sponsorId={sponsor.id}
                            isActive={sponsor.active}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
