export const dynamic = "force-dynamic";

import { getAdminSession } from "@/app/actions/admin-auth";
import { redirect } from "next/navigation";
import { ProvisionTenantForm } from "@/components/admin/ProvisionTenantForm";

export default async function NovoTenantPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") redirect("/admin/dashboard");

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Novo Tenant</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Provisiona um banco de dados isolado e ativa o domínio do cliente automaticamente.
        </p>
      </div>
      <ProvisionTenantForm />
    </div>
  );
}
