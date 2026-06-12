import { getAdminPersonalities } from "@/app/actions/admin-institutional";
import { PersonalityActions } from "@/components/admin/PersonalityActions";
import Link from "next/link";
import { Plus } from "lucide-react";

const categoryLabels: Record<string, string> = {
  medicos: "Médicos",
  dirigentes: "Dirigentes",
  tecnicos: "Técnicos",
  voluntarios: "Voluntários",
};

const categoryColors: Record<string, string> = {
  medicos: "bg-red-500/15 text-red-600",
  dirigentes: "bg-blue-500/15 text-blue-600",
  tecnicos: "bg-green-500/15 text-green-600",
  voluntarios: "bg-amber-500/15 text-amber-600",
};

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function PersonalidadesPage({ searchParams }: PageProps) {
  const { category } = await searchParams;

  const personalities = await getAdminPersonalities(category);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          PERSONALIDADES
        </h2>
        <Link
          href="/admin/personalidades/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova Personalidade
        </Link>
      </div>

      {/* Filters */}
      <form
        method="get"
        action="/admin/personalidades"
        className="flex flex-wrap gap-3"
      >
        <select
          name="category"
          defaultValue={category ?? ""}
          className="bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(categoryLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Filtrar
        </button>
        {category && (
          <Link
            href="/admin/personalidades"
            className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
          >
            Limpar
          </Link>
        )}
      </form>

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
                  Cargo
                </th>
                <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                  Categoria
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
              {personalities.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-muted-foreground py-10"
                  >
                    Nenhuma personalidade encontrada
                  </td>
                </tr>
              )}
              {personalities.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {p.name.charAt(0)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.role ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColors[p.category] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {categoryLabels[p.category] ?? p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.order}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.active
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                      }
                    >
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PersonalityActions
                      personalityId={p.id}
                      isActive={p.active}
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
