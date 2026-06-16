"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  Ticket,
  Settings,
  Newspaper,
  Users,
  Star,
  ShoppingBag,
  Users2,
  Repeat2,
  Tag,
  Heart,
  Award,
  Smile,
  Clock,
  UserCog,
  ScrollText,
  Contact,
  X,
  MoreHorizontal,
  Bot,
  Zap,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderBadge } from "./OrderBadge";

interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  moduleKey?: string;
  adminOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

interface AdminSidebarProps {
  role: "admin" | "editor";
  permissions: Record<string, boolean>;
}

// Hrefs pinned to the mobile bottom bar; the rest go in the "Mais" drawer
const MOBILE_PINNED = [
  "/admin/dashboard",
  "/admin/pedidos",
  "/admin/jogos",
  "/admin/validacao",
];

const navGroups: NavGroup[] = [
  {
    title: "Operacional",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
      { label: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart, moduleKey: "pedidos" },
      { label: "Clientes", href: "/admin/clientes", icon: Contact, moduleKey: "pedidos" },
      { label: "Jogos", href: "/admin/jogos", icon: Ticket, moduleKey: "jogos" },
      { label: "Validação", href: "/admin/validacao", icon: ScanLine, moduleKey: "jogos" },
      { label: "Configurações", href: "/admin/configuracoes", icon: Settings, adminOnly: true },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { label: "Notícias", href: "/admin/noticias", icon: Newspaper, moduleKey: "noticias" },
      { label: "Elenco", href: "/admin/elenco", icon: Users, moduleKey: "elenco" },
      { label: "Patrocinadores", href: "/admin/patrocinadores", icon: Star, moduleKey: "patrocinadores" },
      { label: "Loja", href: "/admin/loja", icon: ShoppingBag, moduleKey: "loja" },
    ],
  },
  {
    title: "Institucional",
    items: [
      { label: "Diretoria", href: "/admin/diretoria", icon: Users2, moduleKey: "diretoria" },
      { label: "Lendas", href: "/admin/lendas", icon: Award, moduleKey: "lendas" },
      { label: "Personalidades", href: "/admin/personalidades", icon: Smile, moduleKey: "personalidades" },
      { label: "História", href: "/admin/historia", icon: Clock, moduleKey: "historia" },
    ],
  },
  {
    title: "Crescimento",
    items: [
      { label: "Leads", href: "/admin/leads", icon: Users2, moduleKey: "leads" },
      { label: "Upsell", href: "/admin/upsell", icon: Repeat2, moduleKey: "upsell" },
      { label: "Cupons", href: "/admin/cupons", icon: Tag, moduleKey: "cupons" },
      { label: "Promoções", href: "/admin/promocoes", icon: Zap, moduleKey: "cupons" },
      { label: "Afiliados", href: "/admin/afiliados", icon: Users2, moduleKey: "cupons" },
      { label: "Sócio-Torcedor", href: "/admin/socios", icon: Heart, moduleKey: "socios" },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { label: "Usuários", href: "/admin/usuarios", icon: UserCog, adminOnly: true },
      { label: "Auditoria", href: "/admin/auditoria", icon: ScrollText, adminOnly: true },
      { label: "Assistente IA", href: "/admin/configuracoes/assistente", icon: Bot, adminOnly: true },
    ],
  },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
}

export function AdminSidebar({ role, permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const [moreOpen, setMoreOpen] = useState(false);

  function canSeeItem(item: NavItem): boolean {
    if (item.adminOnly) return isAdmin;
    if (isAdmin) return true;
    if (!item.moduleKey) return true;
    return !!permissions[item.moduleKey];
  }

  const pinnedMobileItems = navGroups
    .flatMap((g) => g.items)
    .filter((i) => MOBILE_PINNED.includes(i.href ?? "") && canSeeItem(i));

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 min-h-screen bg-card border-r border-border flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <span className="font-display text-xl text-primary tracking-wider">
            MISTO ADMIN
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
          {navGroups.map((group) => {
            if (group.adminOnly && !isAdmin) return null;
            const visibleItems = group.items.filter(canSeeItem);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <p className="text-muted-foreground text-xs uppercase tracking-wider px-2 mb-1.5">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => {
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
                  })}
                </ul>
              </div>
            );
          })}
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
