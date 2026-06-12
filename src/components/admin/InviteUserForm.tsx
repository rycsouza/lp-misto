"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteUser } from "@/app/actions/admin-auth";
import { ALL_MODULES } from "@/lib/admin-modules";

export function InviteUserForm() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function togglePermission(key: string) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();

    const result = await inviteUser({ name, email, role, permissions });

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Erro ao enviar convite");
      return;
    }
    setSuccess(email);
  }

  if (success) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center flex flex-col gap-4">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <span className="text-green-400 text-2xl">✓</span>
        </div>
        <div>
          <p className="text-foreground font-medium">Convite enviado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Um e-mail de convite foi enviado para{" "}
            <strong className="text-foreground">{success}</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/admin/usuarios")}
          className="text-primary text-sm hover:underline"
        >
          Voltar para Usuários
        </button>
      </div>
    );
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
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Nome completo"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="email@exemplo.com"
        />
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
          {loading ? "Enviando..." : "Enviar Convite"}
        </button>
      </div>
    </form>
  );
}
