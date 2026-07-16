"use client";

import { useRef } from "react";
import { Building2, LogOut } from "lucide-react";
import { enterTenantContextForm, exitTenantContext } from "@/app/actions/platform-tenants";

interface OrgOption {
  slug: string;
  name: string;
}

/**
 * Barra fixa no topo do painel quando um ADMIN DO SISTEMA está operando um clube.
 * Deixa explícito QUAL clube está em contexto, permite trocar (seletor) e sair
 * para o console. Cor distinta (lime Sport55) para não confundir com o clube.
 */
export function PlatformContextBar({
  orgs,
  currentSlug,
  adminName,
}: {
  orgs: OrgOption[];
  currentSlug: string | null;
  adminName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div
      className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-1.5 border-b border-border text-xs"
      style={{ backgroundColor: "rgba(198,255,0,0.08)" }}
    >
      <span className="flex items-center gap-1.5 font-semibold tracking-wider shrink-0" style={{ color: "#C6FF00" }}>
        <Building2 size={13} />
        SISTEMA
      </span>

      <span className="hidden sm:inline text-muted-foreground shrink-0">Operando:</span>

      <form ref={formRef} action={enterTenantContextForm} className="min-w-0">
        <label htmlFor="ctx-tenant" className="sr-only">Clube em contexto</label>
        <select
          id="ctx-tenant"
          name="slug"
          defaultValue={currentSlug ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="form-select bg-input border border-border rounded-md px-2 py-1 text-foreground text-xs outline-none focus:ring-2 focus:ring-ring max-w-[55vw] sm:max-w-xs"
        >
          {orgs.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </form>

      <span className="ml-auto shrink-0 hidden md:inline text-muted-foreground/70">{adminName}</span>

      <form action={exitTenantContext} className="shrink-0">
        <button
          type="submit"
          title="Sair do clube (voltar ao console)"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Sair do clube</span>
        </button>
      </form>
    </div>
  );
}
