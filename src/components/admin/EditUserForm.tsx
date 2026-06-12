"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdminUser } from "@/app/actions/admin-auth";
import { ALL_MODULES } from "@/lib/admin-modules";
import type { AdminUserRow } from "@/app/actions/admin-auth";

interface EditUserFormProps {
  user: AdminUserRow;
}

export function EditUserForm({ user }: EditUserFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<"admin" | "editor">(user.role);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    user.permissions ?? {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function togglePermission(key: string) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await updateAdminUser(user.id, { name, role, permissions });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Erro ao atualizar usuário");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted-foreground">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">E-mail</label>
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          {user.email}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Papel</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">
              Admin{" "}
              <span className="text-muted-foreground">(acesso total)</span>
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="editor"
              checked={role === "editor"}
              onChange={() => setRole("editor")}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">
              Editor{" "}
              <span className="text-muted-foreground">(acesso por tela)</span>
            </span>
          </label>
        </div>
      </div>

      {role === "editor" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Permissões de acesso</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MODULES.map((module) => (
              <label key={module.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!permissions[module.key]}
                  onChange={() => togglePermission(module.key)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{module.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-400 bg-green-500/10 rounded-md px-3 py-2">
          Usuário atualizado com sucesso!
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push("/admin/usuarios")}
          className="flex-1 bg-secondary text-secondary-foreground text-sm font-medium py-2.5 rounded-lg hover:opacity-80 transition-opacity"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
