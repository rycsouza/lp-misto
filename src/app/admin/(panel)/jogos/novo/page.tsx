import { GameForm } from "@/components/admin/GameForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NovoJogoPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/jogos"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para jogos
      </Link>

      <h2 className="font-display text-xl text-foreground tracking-wide">
        NOVO JOGO
      </h2>

      <div className="bg-card border border-border rounded-xl p-6">
        <GameForm />
      </div>
    </div>
  );
}
