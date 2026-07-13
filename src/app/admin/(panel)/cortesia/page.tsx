export const dynamic = "force-dynamic";

import { getCourtesyOptions } from "@/app/actions/courtesy-tickets";
import { getSiteConfig } from "@/lib/config";
import { CourtesyTicketForm } from "@/components/admin/CourtesyTicketForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { Gift, Calendar } from "lucide-react";

export default async function CourtesiaPage() {
  const [{ games, globalTypes, sponsors }, config] = await Promise.all([
    getCourtesyOptions(),
    getSiteConfig(),
  ]);

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Gift size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Ingressos de Cortesia</h1>
          <p className="text-sm text-muted-foreground">Gere QR Codes gratuitos sem criar pedido ou pagamento.</p>
        </div>
      </div>

      {games.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Cadastre um jogo primeiro"
          description="As cortesias são emitidas para um jogo em casa."
          action={{ label: "Novo jogo", href: "/admin/jogos/novo" }}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl p-6">
          <CourtesyTicketForm games={games} globalTypes={globalTypes} sponsors={sponsors} siteName={config.siteName || undefined} />
        </div>
      )}
    </div>
  );
}
