import { getAdminGatewayById } from "@/app/actions/admin";
import { GatewayForm } from "@/components/admin/GatewayForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarGatewayPage({ params }: PageProps) {
  const { id } = await params;
  const gateway = await getAdminGatewayById(id);

  if (!gateway) notFound();

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
          EDITAR GATEWAY
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Atualize as configurações do gateway {gateway.name}.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <GatewayForm
          mode="edit"
          id={gateway.id}
          defaultValues={{
            name: gateway.name,
            slug: gateway.slug,
            active: gateway.active,
            paymentMethods: gateway.paymentMethods,
            credentials: gateway.credentials,
          }}
        />
      </div>
    </div>
  );
}
