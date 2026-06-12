import { getAdminUsersList, getPendingInvites, getAdminSession } from "@/app/actions/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { InviteActionButtons } from "@/components/admin/InviteActionButtons";

function formatDate(date: Date | null) {
  if (!date) return "Nunca";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiry(date: Date) {
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Expirado";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

export default async function UsuariosPage() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") redirect("/admin/dashboard");

  const [users, pendingInvites] = await Promise.all([
    getAdminUsersList(),
    getPendingInvites(),
  ]);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Usuários</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os usuários e permissões do painel
          </p>
        </div>
        <Link
          href="/admin/usuarios/convidar"
          className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + Convidar Usuário
        </Link>
      </div>

      {/* Active Users */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Usuários Ativos
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-mail</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Papel</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Último acesso</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.role === "admin"
                          ? "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase tracking-wider"
                          : "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium uppercase tracking-wider"
                      }
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(user.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        user.active
                          ? "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium"
                          : "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium"
                      }
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AdminUserActions user={user} currentUserId={session.userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Invites */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">
          Convites Pendentes
          {pendingInvites.length > 0 && (
            <span className="ml-2 text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
              {pendingInvites.length}
            </span>
          )}
        </h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {pendingInvites.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              Nenhum convite pendente
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-mail</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Papel</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Expira em</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{invite.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{invite.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          invite.role === "admin"
                            ? "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase tracking-wider"
                            : "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium uppercase tracking-wider"
                        }
                      >
                        {invite.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatExpiry(invite.expiresAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InviteActionButtons inviteId={invite.id} email={invite.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
