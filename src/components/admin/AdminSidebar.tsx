"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { X, MoreHorizontal, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderBadge } from "./OrderBadge";
import { navGroups, MOBILE_PINNED } from "@/lib/admin/nav";
import type { NavItem } from "@/lib/admin/nav";

interface AdminSidebarProps {
  role: "admin" | "editor";
  permissions: Record<string, boolean>;
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
}

/** Normaliza texto p/ busca: minúsculo e sem acentos (ex.: "Validação" → "validacao"). */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Título do grupo que contém a página atualmente ativa (ou null). */
function activeGroupTitle(pathname: string): string | null {
  for (const g of navGroups) {
    if (g.items.some((i) => i.href && isItemActive(pathname, i.href))) return g.title;
  }
  return null;
}

export function AdminSidebar({ role, permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Acordeão single-open: apenas um grupo aberto por vez. `openGroup === undefined`
  // significa "o usuário ainda não interagiu" → abre o grupo da página atual.
  const activeGroup = activeGroupTitle(pathname);
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  const effectiveOpen = openGroup === undefined ? activeGroup : openGroup;

  function toggleGroup(title: string) {
    // Abrir um grupo fecha os demais; clicar no já aberto fecha tudo.
    setOpenGroup((cur) => {
      const current = cur === undefined ? activeGroup : cur;
      return current === title ? null : title;
    });
  }

  function canSeeItem(item: NavItem): boolean {
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
      <aside className="hidden md:flex w-60 min-h-screen bg-card border-r border-border flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <span className="font-display text-xl text-primary tracking-wider">
            MISTO ADMIN
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
            /* Modo normal — acordeão single-open */
            navGroups.map((group) => {
              if (group.adminOnly && !isAdmin) return null;
              const visibleItems = group.items.filter(canSeeItem);
              if (visibleItems.length === 0) return null;

              const open = group.title === effectiveOpen;

              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-2 px-2 mb-1.5 text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      size={14}
                      className={cn("transition-transform shrink-0", open ? "" : "-rotate-90")}
                    />
                  </button>
                  <ul className={cn("flex flex-col gap-0.5", open ? "" : "hidden")}>
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
