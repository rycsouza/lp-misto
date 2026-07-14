export const dynamic = "force-dynamic";

import { getAdminPersonalities } from "@/app/actions/admin-institutional";
import { DraggablePersonalidadesTable } from "@/components/admin/DraggablePersonalidadesTable";
import Link from "next/link";
import { Plus } from "lucide-react";

const categoryLabels: Record<string, string> = {
  medicos: "Médicos",
  dirigentes: "Dirigentes",
  tecnicos: "Técnicos",
  voluntarios: "Voluntários",
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
        <h2 className="font-display text-xl text-foreground tracking-wide">PERSONALIDADES</h2>
        <Link
          href="/admin/personalidades/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Nova Personalidade
        </Link>
      </div>

      {/* Filters */}
      <form method="get" action="/admin/personalidades" className="flex flex-wrap gap-3">
        <select
          name="category"
          defaultValue={category ?? ""}
          className="form-select bg-input border border-border rounded-md pl-3 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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

      <DraggablePersonalidadesTable personalities={personalities} />
    </div>
  );
}
