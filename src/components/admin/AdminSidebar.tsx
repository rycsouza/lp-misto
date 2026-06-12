"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Heart,
  Award,
  Smile,
  Clock,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
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

const navGroups: NavGroup[] = [
  {
    title: "Operacional",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: <LayoutDashboard size={16} />,
        moduleKey: "dashboard",
      },
      {
        label: "Pedidos",
        href: "/admin/pedidos",
        icon: <ShoppingCart size={16} />,
        moduleKey: "pedidos",
      },
      {
        label: "Jogos",
        href: "/admin/jogos",
        icon: <Ticket size={16} />,
        moduleKey: "jogos",
      },
      {
        label: "Configurações",
        href: "/admin/configuracoes",
        icon: <Settings size={16} />,
        adminOnly: true,
      },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      {
        label: "Notícias",
        href: "/admin/noticias",
        icon: <Newspaper size={16} />,
        moduleKey: "noticias",
      },
      {
        label: "Elenco",
        href: "/admin/elenco",
        icon: <Users size={16} />,
        moduleKey: "elenco",
      },
      {
        label: "Patrocinadores",
        href: "/admin/patrocinadores",
        icon: <Star size={16} />,
        moduleKey: "patrocinadores",
      },
      {
        label: "Loja",
        href: "/admin/loja",
        icon: <ShoppingBag size={16} />,
        moduleKey: "loja",
      },
    ],
  },
  {
    title: "Institucional",
    items: [
      {
        label: "Diretoria",
        href: "/admin/diretoria",
        icon: <Users2 size={16} />,
        moduleKey: "diretoria",
      },
      {
        label: "Lendas",
        href: "/admin/lendas",
        icon: <Award size={16} />,
        moduleKey: "lendas",
      },
      {
        label: "Personalidades",
        href: "/admin/personalidades",
        icon: <Smile size={16} />,
        moduleKey: "personalidades",
      },
      {
        label: "História",
        href: "/admin/historia",
        icon: <Clock size={16} />,
        moduleKey: "historia",
      },
    ],
  },
  {
    title: "Crescimento",
    items: [
      {
        label: "Leads",
        href: "/admin/leads",
        icon: <Users2 size={16} />,
        moduleKey: "leads",
        disabled: true,
      },
      {
        label: "Upsell",
        href: "/admin/upsell",
        icon: <Repeat2 size={16} />,
        moduleKey: "upsell",
        disabled: true,
      },
      {
        label: "Sócio-Torcedor",
        href: "/admin/socios",
        icon: <Heart size={16} />,
        moduleKey: "socios",
        disabled: true,
      },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      {
        label: "Usuários",
        href: "/admin/usuarios",
        icon: <UserCog size={16} />,
        adminOnly: true,
      },
    ],
  },
];

export function AdminSidebar({ role, permissions }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  function canSeeItem(item: NavItem): boolean {
    if (item.adminOnly) return isAdmin;
    if (isAdmin) return true;
    if (!item.moduleKey) return true;
    return !!permissions[item.moduleKey];
  }

  return (
    <aside className="w-60 min-h-screen bg-card border-r border-border flex flex-col flex-shrink-0">
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
                  const isActive = item.href
                    ? pathname === item.href ||
                      (item.href !== "/admin/dashboard" &&
                        pathname.startsWith(item.href))
                    : false;

                  if (item.disabled) {
                    return (
                      <li key={item.label}>
                        <span className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-muted-foreground/50 text-sm cursor-not-allowed">
                          {item.icon}
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
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                      >
                        {item.icon}
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
    </aside>
  );
}
