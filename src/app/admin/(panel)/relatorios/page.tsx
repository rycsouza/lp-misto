export const dynamic = "force-dynamic";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { SalesReport } from "@/components/admin/SalesReport";
import { PostGameReport } from "@/components/admin/PostGameReport";

interface PageProps {
  searchParams: Promise<{
    aba?: string;
    from?: string;
    to?: string;
    cortesia?: string;
    game?: string;
  }>;
}

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
  const aba = sp.aba === "pos-jogo" ? "pos-jogo" : "vendas";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-foreground tracking-wide">RELATÓRIOS</h2>
        <div className="flex gap-1 p-1 bg-secondary/40 border border-border rounded-xl w-full sm:w-auto sm:inline-flex sm:self-start">
          <TabLink href="/admin/relatorios" active={aba === "vendas"} label="Vendas" />
          <TabLink href="/admin/relatorios?aba=pos-jogo" active={aba === "pos-jogo"} label="Pós-jogo" />
        </div>
      </div>

      {aba === "vendas" ? (
        <SalesReport from={sp.from} to={sp.to} cortesia={sp.cortesia} />
      ) : (
        <PostGameReport game={sp.game} />
      )}
    </div>
  );
}
