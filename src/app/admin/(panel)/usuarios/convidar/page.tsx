export const dynamic = "force-dynamic";

import { getAdminSession } from "@/app/actions/admin-auth";
import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/admin/InviteUserForm";

export default async function ConvidarPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") redirect("/admin/dashboard");

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Convidar Usuário</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Envie um convite por e-mail para adicionar um novo usuário ao painel
        </p>
      </div>
      <InviteUserForm />
    </div>
  );
}
