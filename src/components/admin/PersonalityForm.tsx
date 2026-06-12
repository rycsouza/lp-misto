"use client";

import { useActionState } from "react";
import {
  createPersonality,
  updatePersonality,
} from "@/app/actions/admin-institutional";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type PersonalityFormState =
  | { success: boolean; error?: string }
  | undefined;

interface PersonalityData {
  id?: string;
  name?: string;
  photoUrl?: string | null;
  role?: string | null;
  category?: string;
  active?: boolean;
  order?: number;
}

interface PersonalityFormProps {
  personality?: PersonalityData;
}

export function PersonalityForm({ personality }: PersonalityFormProps) {
  const router = useRouter();
  const isEditing = !!personality?.id;

  async function handleCreate(
    _prev: PersonalityFormState,
    formData: FormData
  ): Promise<PersonalityFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      role: (formData.get("role") as string) || null,
      category: formData.get("category") as string,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return createPersonality(data);
  }

  async function handleUpdate(
    _prev: PersonalityFormState,
    formData: FormData
  ): Promise<PersonalityFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      role: (formData.get("role") as string) || null,
      category: formData.get("category") as string,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return updatePersonality(personality!.id!, data);
  }

  const [state, action, pending] = useActionState<
    PersonalityFormState,
    FormData
  >(isEditing ? handleUpdate : handleCreate, undefined);

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/personalidades");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Nome *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={personality?.name ?? ""}
            className={inputClass}
            placeholder="Nome completo"
          />
        </div>

        <div>
          <label htmlFor="role" className={labelClass}>
            Cargo
          </label>
          <input
            id="role"
            name="role"
            type="text"
            defaultValue={personality?.role ?? ""}
            className={inputClass}
            placeholder="Ex: Médico do Clube"
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Categoria *
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={personality?.category ?? ""}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            <option value="medicos">Médicos</option>
            <option value="dirigentes">Dirigentes</option>
            <option value="tecnicos">Técnicos</option>
            <option value="voluntarios">Voluntários</option>
          </select>
        </div>

        <div>
          <label htmlFor="order" className={labelClass}>
            Ordem
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={0}
            defaultValue={personality?.order ?? 0}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="photoUrl" className={labelClass}>
            URL da Foto
          </label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="text"
            defaultValue={personality?.photoUrl ?? ""}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={personality?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Ativo (exibir na plataforma)
        </label>
      </div>

      {state && !state.success && state.error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : "Salvar Personalidade"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/personalidades")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
