"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { X, MoreHorizontal, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderBadge } from "./OrderBadge";
import { navGroups, MOBILE_PINNED } from "@/lib/admin/nav";
import type { NavItem } from "@/lib/admin/nav";

interface AdminSidebarProps {
  role: "admin" | "editor";
  permissions: Record<string, boolean>;
  /** Nome do clube (tenant) — marca o topo da sidebar. White-label. */
  siteName?: string;
  /** true = admin do SISTEMA (libera itens platform-only). */
  isPlatform?: boolean;
  /** Prefixos de rota de features desligadas (kill-switch) — itens somem. */
  disabledRoutes?: string[];
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
}

/** Normaliza texto p/ busca: minúsculo e sem acentos (ex.: "Validação" → "validacao"). */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function AdminSidebar({ role, permissions, siteName, isPlatform = false, disabledRoutes = [] }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const brand = siteName?.trim() ? siteName.trim().toUpperCase() : "PAINEL";
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  function canSeeItem(item: NavItem): boolean {
    // Kill-switch: item de feature desligada some para todos.
    if (item.href && disabledRoutes.some((r) => item.href!.startsWith(r))) return false;
    if (item.platformOnly) return isPlatform;
    if (item.adminOnly) return isAdmin;
    if (isAdmin) return true;
    if (!item.moduleKey) return true;
    return !!permissions[item.moduleKey];
  }

  // Itens que casam com a busca (em todos os grupos visíveis), para o modo de pesquisa
  const q = normalize(query.trim());
  const searchResults = q
    ? navGroups
        .filter((g) => !(g.adminOnly && !isAdmin))
        .flatMap((g) => g.items.filter(canSeeItem))
        .filter((i) => normalize(i.label).includes(q))
    : [];

  /** Renderiza um item de navegação (link ou "em breve"). */
  function renderItem(item: NavItem) {
    const active = item.href ? isItemActive(pathname, item.href) : false;
    const Icon = item.icon;

    if (item.disabled) {
      return (
        <li key={item.label}>
          <span className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-muted-foreground/50 text-sm cursor-not-allowed">
            <Icon size={16} />
            <span>{item.label}</span>
            <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              em breve
            </span>
          </span>
        </li>
      );
    }

    return (
      <li key={item.label}>
        <Link
          href={item.href!}
          onClick={() => setQuery("")}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors",
            active
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Icon size={16} />
          <span>{item.label}</span>
          {item.href === "/admin/pedidos" && <OrderBadge />}
        </Link>
      </li>
    );
  }

  const pinnedMobileItems = navGroups
    .flatMap((g) => g.items)
    .filter((i) => MOBILE_PINNED.includes(i.href ?? "") && canSeeItem(i));

  const hasMoreItems = navGroups.some((g) => {
    if (g.adminOnly && !isAdmin) return false;
    return g.items.filter(canSeeItem).some((i) => !MOBILE_PINNED.includes(i.href ?? ""));
  });

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 h-screen bg-card border-r border-border flex-col flex-shrink-0">
        <div className="h-14 flex items-center gap-1.5 px-4 border-b border-border min-w-0">
          <span className="font-display text-xl text-primary tracking-wider truncate" title={`${brand} — Admin`}>
            {brand}
          </span>
          <span className="font-display text-xl text-muted-foreground/60 tracking-wider shrink-0">
            ADMIN
          </span>
        </div>

        {/* Busca */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no menu..."
              className="w-full bg-input border border-border rounded-lg pl-8 pr-8 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
          {q ? (
            /* Modo busca — lista achatada dos itens que casam */
            searchResults.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {searchResults.map(renderItem)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground px-2 py-1">
                Nada encontrado para &quot;{query.trim()}&quot;.
              </p>
            )
          ) : (
            /* Modo normal — grupos sempre visíveis (sem acordeão): o operador
               sempre vê tudo, sem precisar caçar o que "sumiu" num toggle. */
            navGroups.map((group) => {
              if (group.adminOnly && !isAdmin) return null;
              const visibleItems = group.items.filter(canSeeItem);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title}>
                  <p className="px-2 mb-1.5 text-muted-foreground text-xs uppercase tracking-wider">
                    {group.title}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {visibleItems.map(renderItem)}
                  </ul>
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Mobile Bottom Nav ────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border flex items-stretch"
        style={{
          height: "calc(4rem + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {pinnedMobileItems.map((item) => {
          const active = item.href ? isItemActive(pathname, item.href) : false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <Icon size={22} />
                {item.href === "/admin/pedidos" && (
                  <OrderBadge className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-0.5" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {hasMoreItems && (
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal size={22} />
            <span>Mais</span>
          </button>
        )}
      </nav>

      {/* ── Mobile More Drawer ───────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-2xl max-h-[78vh] flex flex-col shadow-2xl">
            {/* Handle + header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border" />
              <span className="font-semibold text-sm">Menu</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 -mr-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav groups */}
            <nav className="overflow-y-auto flex-1 px-4 py-4 pb-8 flex flex-col gap-5">
              {navGroups.map((group) => {
                if (group.adminOnly && !isAdmin) return null;
                const items = group.items
                  .filter(canSeeItem)
                  .filter((i) => !MOBILE_PINNED.includes(i.href ?? ""));
                if (items.length === 0) return null;

                return (
                  <div key={group.title}>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2 px-1">
                      {group.title}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {items.map((item) => {
                        const active = item.href ? isItemActive(pathname, item.href) : false;
                        const Icon = item.icon;

                        if (item.disabled) {
                          return (
                            <li key={item.label}>
                              <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground/50 text-sm cursor-not-allowed">
                                <Icon size={18} />
                                <span>{item.label}</span>
                                <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                  em breve
                                </span>
                              </span>
                            </li>
                          );
                        }

                        return (
                          <li key={item.label}>
                            <Link
                              href={item.href!}
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                              )}
                            >
                              <Icon size={18} />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
