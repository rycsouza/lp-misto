export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminRaffleById } from "@/app/actions/admin-raffles";
import { RaffleForm } from "@/components/admin/RaffleForm";

export default async function EditarRifaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getAdminRaffleById(id);
  if (!raffle) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/rifas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <h2 className="font-display text-xl text-foreground tracking-wide">{raffle.name}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {raffle.soldCount.toLocaleString("pt-BR")} de {raffle.totalNumbers.toLocaleString("pt-BR")} números vendidos
        </p>
      </div>

      <RaffleForm raffle={raffle} prizes={raffle.prizes} />
    </div>
  );
}
