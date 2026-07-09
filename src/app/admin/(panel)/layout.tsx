import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AgentSlideOver } from "@/components/admin/AgentSlideOver";
import { headers } from "next/headers";
import { getAdminSession } from "@/app/actions/admin-auth";
import { redirect } from "next/navigation";
import { canAccessRoute, getFirstAccessibleRoute } from "@/lib/admin/nav";

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/dashboard")) return "Dashboard";
  if (pathname.startsWith("/admin/relatorios")) return "Relatórios";
  if (pathname.startsWith("/admin/pedidos")) return "Pedidos";
  if (pathname.startsWith("/admin/jogos")) return "Jogos";
  if (pathname.startsWith("/admin/configuracoes/emails")) return "Reenvio de E-mails";
  if (pathname.startsWith("/admin/configuracoes")) return "Configurações";
  if (pathname.startsWith("/admin/noticias")) return "Notícias";
  if (pathname.startsWith("/admin/elenco")) return "Elenco";
  if (pathname.startsWith("/admin/patrocinadores")) return "Patrocinadores";
  if (pathname.startsWith("/admin/diretoria")) return "Diretoria";
  if (pathname.startsWith("/admin/lendas")) return "Lendas";
  if (pathname.startsWith("/admin/personalidades")) return "Personalidades";
  if (pathname.startsWith("/admin/historia")) return "História";
  if (pathname.startsWith("/admin/loja")) return "Loja";
  if (pathname.startsWith("/admin/leads")) return "Leads";
  if (pathname.startsWith("/admin/upsell")) return "Upsell";
  if (pathname.startsWith("/admin/cupons")) return "Cupons";
  if (pathname.startsWith("/admin/socios")) return "Sócio-Torcedor";
  if (pathname.startsWith("/admin/usuarios")) return "Usuários";
  if (pathname.startsWith("/admin/validacao")) return "Validação de Ingressos";
  if (pathname.startsWith("/admin/cortesia")) return "Ingressos de Cortesia";
  if (pathname.startsWith("/admin/tenants")) return "Tenants";
  if (pathname.startsWith("/admin/cantina")) return "Cantina";
  return "Admin";
}

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (!canAccessRoute(pathname, session.role, session.permissions ?? {})) {
    redirect(getFirstAccessibleRoute(session.role, session.permissions ?? {}));
  }

  const title = getPageTitle(pathname);
  const { getSiteConfig } = await import("@/lib/config");
  const siteName = (await getSiteConfig().catch(() => null))?.siteName || undefined;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={session.role} permissions={session.permissions} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <AdminHeader title={title} userName={session.name} userRole={session.role} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>
        <footer className="hidden md:flex px-6 py-3 border-t border-border items-center justify-end gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <p className="text-xs text-muted-foreground/40">
            Desenvolvido por <span style={{ color: "#C6FF00" }} className="font-semibold opacity-80">Sport55</span>
            <span className="ml-1.5 opacity-60">· CNPJ 49.791.388/0001-85</span>
          </p>
        </footer>
      </div>
      <AgentSlideOver siteName={siteName} />
    </div>
  );
}
