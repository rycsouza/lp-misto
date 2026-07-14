export const dynamic = "force-dynamic";

import { getCourtesyOptions } from "@/app/actions/courtesy-tickets";
import { getSiteConfig } from "@/lib/config";
import { CourtesyTicketForm } from "@/components/admin/CourtesyTicketForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { Gift, Calendar, BarChart3, Printer, ScanLine } from "lucide-react";

export default async function CourtesiaPage() {
  const [{ games, globalTypes, sponsors }, config] = await Promise.all([
    getCourtesyOptions(),
    getSiteConfig(),
  ]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6 items-start">
          <div className="bg-card border border-border rounded-xl p-6">
            <CourtesyTicketForm games={games} globalTypes={globalTypes} sponsors={sponsors} siteName={config.siteName || undefined} />
          </div>

          {/* Painel de apoio — usa o espaço no desktop e orienta o operador. */}
          <aside className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Como funciona</p>
            <ul className="flex flex-col gap-3.5 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <Gift size={16} className="text-primary shrink-0 mt-0.5" />
                <span>Cortesias são <span className="text-foreground">gratuitas</span> — não geram pedido nem pagamento.</span>
              </li>
              <li className="flex gap-2.5">
                <Printer size={16} className="text-primary shrink-0 mt-0.5" />
                <span>Depois de gerar, <span className="text-foreground">imprima em A4</span> (vários por folha) ou térmica 58&nbsp;mm, ou envie o QR por e-mail.</span>
              </li>
              <li className="flex gap-2.5">
                <ScanLine size={16} className="text-primary shrink-0 mt-0.5" />
                <span>Na portaria, valida como <span className="text-foreground">qualquer ingresso</span>, na tela de Validação.</span>
              </li>
              <li className="flex gap-2.5">
                <BarChart3 size={16} className="text-primary shrink-0 mt-0.5" />
                <span>Nos relatórios, ficam <span className="text-foreground">fora da receita</span> — só aparecem ao ativar “Ver cortesias”.</span>
              </li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
