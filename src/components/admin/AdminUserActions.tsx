"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdminUser } from "@/app/actions/admin-auth";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import type { AdminUserRow } from "@/app/actions/admin-auth";

interface AdminUserActionsProps {
  user: AdminUserRow;
  currentUserId: string;
}

export function AdminUserActions({ user, currentUserId }: AdminUserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isSelf = user.id === currentUserId;

  async function handleConfirmToggle() {
    setConfirmOpen(false);
    setLoading(true);
    await updateAdminUser(user.id, { active: !user.active });
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => router.push(`/admin/usuarios/${user.id}`)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
        >
          Editar
        </button>
        {!isSelf && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmOpen(true)}
            className={
              user.active
                ? "text-xs text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                : "text-xs text-green-400 hover:text-green-300 transition-colors px-2 py-1 rounded hover:bg-green-500/10 disabled:opacity-50"
            }
          >
            {loading ? "..." : user.active ? "Desativar" : "Ativar"}
          </button>
        )}
      </div>
      <ConfirmModal
        open={confirmOpen}
        title={user.active ? "Desativar usuário?" : "Ativar usuário?"}
        description={
          user.active
            ? `${user.name} perderá acesso ao painel imediatamente.`
            : `${user.name} voltará a ter acesso ao painel.`
        }
        confirmLabel={user.active ? "Desativar" : "Ativar"}
        isPending={loading}
        onConfirm={handleConfirmToggle}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
