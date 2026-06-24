export const dynamic = "force-dynamic";

import { PlayerForm } from "@/components/admin/PlayerForm";
import { getCurrentSeason } from "@/app/actions/admin-content";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NovoJogadorPage() {
  const currentSeason = await getCurrentSeason();

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
        NOVO JOGADOR
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <PlayerForm defaultSeason={currentSeason} />
      </div>
    </div>
  );
}
