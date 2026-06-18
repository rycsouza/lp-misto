import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AgentSlideOver } from "@/components/admin/AgentSlideOver";
import { headers } from "next/headers";
import { getAdminSession } from "@/app/actions/admin-auth";
import { redirect } from "next/navigation";

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/dashboard")) return "Dashboard";
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
  const title = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={session.role} permissions={session.permissions} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <AdminHeader title={title} userName={session.name} userRole={session.role} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>
        <footer className="hidden md:block px-6 py-3 border-t border-border text-right">
          <p className="text-xs text-muted-foreground/40">
            Desenvolvido por Sport55 · CNPJ 49.791.388/0001-85
          </p>
        </footer>
      </div>
      <AgentSlideOver />
    </div>
  );
}
