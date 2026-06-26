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
  BarChart3,
  Contact,
  Bot,
  Zap,
  ScanLine,
  Mail,
  Building2,
  Gift,
  PackageCheck,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  moduleKey?: string;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

/** Hrefs fixos na bottom bar mobile; o resto vai no drawer "Mais" */
export const MOBILE_PINNED = [
  "/admin/dashboard",
  "/admin/pedidos",
  "/admin/jogos",
  "/admin/validacao",
];

export const navGroups: NavGroup[] = [
  {
    title: "Operacional",
    items: [
      { label: "Dashboard",      href: "/admin/dashboard",     icon: LayoutDashboard, moduleKey: "dashboard" },
      { label: "Relatórios",     href: "/admin/relatorios",    icon: BarChart3,       moduleKey: "dashboard" },
      { label: "Pedidos",        href: "/admin/pedidos",       icon: ShoppingCart,    moduleKey: "pedidos" },
      { label: "Clientes",       href: "/admin/clientes",      icon: Contact,         moduleKey: "pedidos" },
      { label: "Jogos",          href: "/admin/jogos",         icon: Ticket,          moduleKey: "jogos" },
      { label: "Validação",      href: "/admin/validacao",     icon: ScanLine,        moduleKey: "jogos" },
      { label: "Retirada",       href: "/admin/retirada",      icon: PackageCheck,    moduleKey: "pedidos" },
      { label: "Cortesia",       href: "/admin/cortesia",      icon: Gift,            moduleKey: "jogos" },
      { label: "Configurações",  href: "/admin/configuracoes", icon: Settings,        adminOnly: true },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { label: "Notícias",       href: "/admin/noticias",      icon: Newspaper,  moduleKey: "noticias" },
      { label: "Elenco",         href: "/admin/elenco",        icon: Users,      moduleKey: "elenco" },
      { label: "Patrocinadores", href: "/admin/patrocinadores",icon: Star,       moduleKey: "patrocinadores" },
      { label: "Loja",           href: "/admin/loja",          icon: ShoppingBag,moduleKey: "loja" },
    ],
  },
  {
    title: "Institucional",
    items: [
      { label: "Diretoria",      href: "/admin/diretoria",     icon: Users2, moduleKey: "diretoria" },
      { label: "Lendas",         href: "/admin/lendas",        icon: Award,  moduleKey: "lendas" },
      { label: "Personalidades", href: "/admin/personalidades",icon: Smile,  moduleKey: "personalidades" },
      { label: "História",       href: "/admin/historia",      icon: Clock,  moduleKey: "historia" },
    ],
  },
  {
    title: "Crescimento",
    items: [
      { label: "Leads",          href: "/admin/leads",         icon: Users2,  moduleKey: "leads" },
      { label: "Upsell",         href: "/admin/upsell",        icon: Repeat2, moduleKey: "upsell" },
      { label: "Cupons",         href: "/admin/cupons",        icon: Tag,     moduleKey: "cupons" },
      { label: "Promoções",      href: "/admin/promocoes",     icon: Zap,     moduleKey: "cupons" },
      { label: "Afiliados",      href: "/admin/afiliados",     icon: Users2,  moduleKey: "cupons" },
      { label: "Campanhas",      href: "/admin/campanhas",     icon: Mail,    adminOnly: true },
      { label: "Sócio-Torcedor", href: "/admin/socios",        icon: Heart,   moduleKey: "socios" },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { label: "Usuários",         href: "/admin/usuarios",                  icon: UserCog,  adminOnly: true },
      { label: "Auditoria",        href: "/admin/auditoria",                 icon: ScrollText,adminOnly: true },
      { label: "Reenvio de E-mails",href: "/admin/configuracoes/emails",    icon: Mail,     adminOnly: true },
      { label: "Assistente IA",    href: "/admin/configuracoes/assistente",  icon: Bot,      adminOnly: true },
      { label: "Novo Tenant",      href: "/admin/tenants/novo",              icon: Building2,adminOnly: true },
    ],
  },
];

/** Verifica se um usuário tem acesso à rota — fonte única de verdade. */
export function canAccessRoute(
  pathname: string,
  role: "admin" | "editor",
  permissions: Record<string, boolean>
): boolean {
  if (role === "admin") return true;

  const allItems = navGroups.flatMap((g) => g.items).filter((i) => i.href);

  // Encontra o item mais específico que cobre o pathname (maior prefixo)
  const match = allItems
    .filter((i) => pathname.startsWith(i.href!))
    .sort((a, b) => b.href!.length - a.href!.length)[0];

  if (!match) return true; // rota não mapeada → permitida
  if (match.adminOnly) return false;
  if (!match.moduleKey) return true;
  return !!permissions[match.moduleKey];
}
