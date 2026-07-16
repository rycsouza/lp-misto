export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Building2, LogOut, Globe, ArrowRight } from "lucide-react";
import { getPlatformSession, platformLogout } from "@/app/actions/platform-auth";
import { getPlatformOrganizations, enterTenantContextForm } from "@/app/actions/platform-tenants";

export default async function PlatformConsolePage() {
  const session = await getPlatformSession();
  if (!session) redirect("/admin/sistema/login");

  const orgs = await getPlatformOrganizations().catch(() => []);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl tracking-wider" style={{ color: "#C6FF00" }}>
            SPORT55
          </span>
          <span className="font-display text-xl text-muted-foreground/60 tracking-wider">SISTEMA</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            Olá, <span className="text-foreground font-medium">{session.name}</span>
          </span>
          <form action={platformLogout}>
            <button
              type="submit"
              title="Sair"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl tracking-wide text-foreground">Clubes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orgs.length} {orgs.length === 1 ? "clube cadastrado" : "clubes cadastrados"} na plataforma.
          </p>
        </div>

        {orgs.length === 0 ? (
          <div className="border border-border rounded-xl p-8 text-center text-muted-foreground">
            Nenhum clube cadastrado ainda.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {orgs.map((o) => (
              <li key={o.id} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Building2 size={18} className="text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.slug}</p>
                    </div>
                  </div>
                  <span
                    className={
                      o.status === "active"
                        ? "text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase tracking-wider shrink-0"
                        : "text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium uppercase tracking-wider shrink-0"
                    }
                  >
                    {o.status}
                  </span>
                </div>
                {o.primaryDomain && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <Globe size={12} className="shrink-0" />
                    <span className="truncate">{o.primaryDomain}</span>
                  </p>
                )}
                <form action={enterTenantContextForm} className="mt-3">
                  <input type="hidden" name="slug" value={o.slug} />
                  <button
                    type="submit"
                    disabled={o.status !== "active"}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    Entrar no painel <ArrowRight size={15} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground/60 mt-8">
          Entrar num clube abre o painel operando sobre os dados dele. Kill-switch de features na aba abaixo.
        </p>
      </main>
    </div>
  );
}
