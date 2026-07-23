export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RaffleForm } from "@/components/admin/RaffleForm";

export default function NovaRifaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/sorteios" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <h2 className="font-display text-xl text-foreground tracking-wide">NOVO SORTEIO</h2>
      </div>
      <RaffleForm />
    </div>
  );
}
