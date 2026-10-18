export const dynamic = "force-dynamic";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesReport } from "@/components/admin/SalesReport";
import { PostGameReport } from "@/components/admin/PostGameReport";
import { RaffleReport } from "@/components/admin/RaffleReport";
import { MembershipReport } from "@/components/admin/MembershipReport";
import { RAFFLES_ENABLED } from "@/lib/product-flags";
import { checkModuleAccess } from "@/lib/admin/auth-guard";

interface PageProps {
  searchParams: Promise<{
    aba?: string;
    from?: string;
    to?: string;
    cortesia?: string;
    game?: string;
    sorteio?: string;
    rifa?: string; // legado
  }>;
}

type Aba = "vendas" | "pos-jogo" | "sorteios" | "socios";

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 sm:flex-none text-center px-6 py-3 rounded-lg text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

/**
 * Tela unificada de relatórios. Duas abas de topo, cada uma dona do seu próprio
 * filtro (Vendas = período; Pós-jogo = jogo). Renderiza só a aba ativa no
 * servidor, então não buscamos os dois conjuntos de dados de uma vez.
 */
export default async function RelatoriosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  // "sorteios" é o nome atual; "rifas" segue aceito para links/bookmarks antigos.
  const rawAba: Aba =
    sp.aba === "pos-jogo"
      ? "pos-jogo"
      : sp.aba === "sorteios" || sp.aba === "rifas"
        ? "sorteios"
        : sp.aba === "socios"
          ? "socios"
          : "vendas";
  // Aba Sócio-torcedor: exige o módulo do relatório (dashboard) E o de sócios, com o
  // kill-switch de cada um. Sem acesso, a aba some e o link cai em Vendas. A action
  // reaplica a mesma guarda no servidor.
  const [dashboardAccess, sociosAccess] = await Promise.all([
    checkModuleAccess("dashboard"),
    checkModuleAccess("socios"),
  ]);
  const canSocios = !("error" in dashboardAccess) && !("error" in sociosAccess);
  const aba: Aba =
    rawAba === "socios" && !canSocios
      ? "vendas"
      : rawAba === "sorteios" && !RAFFLES_ENABLED
        ? "vendas" // Sorteios removidos (ver @/lib/product-flags): link antigo cai em Vendas.
        : rawAba;
  const sorteioId = sp.sorteio ?? sp.rifa;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-foreground tracking-wide">RELATÓRIOS</h2>
        <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
          <div className="flex gap-1 p-1 bg-secondary/40 border border-border rounded-xl w-max sm:w-auto sm:inline-flex sm:self-start">
            <TabLink href="/admin/relatorios" active={aba === "vendas"} label="Vendas" />
            <TabLink href="/admin/relatorios?aba=pos-jogo" active={aba === "pos-jogo"} label="Pós-jogo" />
            {canSocios && (
              <TabLink href="/admin/relatorios?aba=socios" active={aba === "socios"} label="Sócio-torcedor" />
            )}
            {RAFFLES_ENABLED && (
              <TabLink href="/admin/relatorios?aba=sorteios" active={aba === "sorteios"} label="Sorteios" />
            )}
          </div>
        </div>
      </div>

      {/* key por aba + filtros: trocar de aba (ou aplicar outro período) monta a
          seção do zero. Sem isso o React reaproveita os campos de data e as
          sub-abas da aba anterior (mesma posição na árvore) — o formulário
          mostrava o período de Vendas e nenhuma sub-aba ficava selecionada. */}
      <div key={`${aba}|${sp.from ?? ""}|${sp.to ?? ""}|${sp.game ?? ""}|${sorteioId ?? ""}`}>
        {aba === "vendas" ? (
          <SalesReport from={sp.from} to={sp.to} cortesia={sp.cortesia} />
        ) : aba === "pos-jogo" ? (
          <PostGameReport game={sp.game} />
        ) : aba === "socios" ? (
          <MembershipReport from={sp.from} to={sp.to} />
        ) : (
          <RaffleReport rifa={sorteioId} />
        )}
      </div>
    </div>
  );
}
