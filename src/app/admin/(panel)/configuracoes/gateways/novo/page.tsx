import { GatewayForm } from "@/components/admin/GatewayForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/app/actions/admin-auth";

export default async function NovoGatewayPage() {
  // Gateways são só do admin do sistema; as actions também barram no servidor.
  const session = await getAdminSession();
  if (session?.isPlatform !== true) redirect("/admin/configuracoes");

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/admin/configuracoes?tab=gateways"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft size={16} />
        Voltar para Gateways
      </Link>

      <div>
        <h2 className="font-display text-xl text-foreground tracking-wide">
          NOVO GATEWAY
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure um novo gateway de pagamento.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <GatewayForm mode="create" />
      </div>
    </div>
  );
}
