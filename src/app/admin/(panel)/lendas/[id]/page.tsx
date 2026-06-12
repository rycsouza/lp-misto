import { getAdminLegendById } from "@/app/actions/admin-institutional";
import { LegendForm } from "@/components/admin/LegendForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarLendaPage({ params }: PageProps) {
  const { id } = await params;
  const legend = await getAdminLegendById(id);

  if (!legend) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/lendas"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para lendas
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR LENDA
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <LegendForm
          legend={{
            id: legend.id,
            name: legend.name,
            photoUrl: legend.photoUrl,
            position: legend.position,
            active: legend.active,
            order: legend.order,
          }}
        />
      </div>
    </div>
  );
}
