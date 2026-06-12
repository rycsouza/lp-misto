import { getAdminUsersList, getAdminSession } from "@/app/actions/admin-auth";
import { redirect, notFound } from "next/navigation";
import { EditUserForm } from "@/components/admin/EditUserForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: Props) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") redirect("/admin/dashboard");

  const { id } = await params;
  const users = await getAdminUsersList();
  const user = users.find((u) => u.id === id);

  if (!user) notFound();

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Editar Usuário</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Atualize o nome, papel e permissões de {user.name}
        </p>
      </div>
      <EditUserForm user={user} />
    </div>
  );
}
