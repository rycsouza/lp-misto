import { getAdminLegends } from "@/app/actions/admin-institutional";
import { LegendActions } from "@/components/admin/LegendActions";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function LendasPage() {
  const legends = await getAdminLegends();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          LENDAS
        </h2>
        <Link
          href="/admin/lendas/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova Lenda
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Foto
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Nome
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Posição
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
              {legends.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhuma lenda cadastrada
                  </td>
                </tr>
              )}
              {legends.map((legend) => (
                <tr
                  key={legend.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                      {legend.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={legend.photoUrl}
                          alt={legend.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {legend.name.charAt(0)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {legend.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {legend.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {legend.order}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        legend.active
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                      }
                    >
                      {legend.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LegendActions
                      legendId={legend.id}
                      isActive={legend.active}
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
}
