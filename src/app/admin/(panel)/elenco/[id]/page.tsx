import { getAdminPlayerById } from "@/app/actions/admin-content";
import { PlayerForm } from "@/components/admin/PlayerForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarJogadorPage({ params }: PageProps) {
  const { id } = await params;
  const player = await getAdminPlayerById(id);

  if (!player) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/elenco"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para elenco
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        EDITAR JOGADOR
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <PlayerForm
          player={{
            id: player.id,
            name: player.name,
            number: player.number,
            position: player.position,
            photoUrl: player.photoUrl,
            season: player.season,
            active: player.active,
          }}
        />
      </div>
    </div>
  );
}
