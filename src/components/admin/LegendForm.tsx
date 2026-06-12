"use client";

import { useActionState } from "react";
import { createLegend, updateLegend } from "@/app/actions/admin-institutional";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ImageUpload } from "./ImageUpload";

type LegendFormState =
  | { success: boolean; error?: string }
  | undefined;

interface LegendData {
  id?: string;
  name?: string;
  photoUrl?: string | null;
  position?: string | null;
  active?: boolean;
  order?: number;
}

interface LegendFormProps {
  legend?: LegendData;
}

export function LegendForm({ legend }: LegendFormProps) {
  const router = useRouter();
  const isEditing = !!legend?.id;

  async function handleCreate(
    _prev: LegendFormState,
    formData: FormData
  ): Promise<LegendFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      position: (formData.get("position") as string) || null,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return createLegend(data);
  }

  async function handleUpdate(
    _prev: LegendFormState,
    formData: FormData
  ): Promise<LegendFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      position: (formData.get("position") as string) || null,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return updateLegend(legend!.id!, data);
  }

  const [state, action, pending] = useActionState<LegendFormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/lendas");
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
            defaultValue={legend?.name ?? ""}
            className={inputClass}
            placeholder="Nome da lenda"
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="position" className={labelClass}>
            Posição
          </label>
          <input
            id="position"
            name="position"
            type="text"
            defaultValue={legend?.position ?? ""}
            className={inputClass}
            placeholder="Ex: Atacante"
          />
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
            defaultValue={legend?.order ?? 0}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <ImageUpload
            name="photoUrl"
            defaultValue={legend?.photoUrl}
            label="Foto"
            folder="misto/lendas"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={legend?.active ?? true}
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
          {pending ? "Salvando..." : "Salvar Lenda"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/lendas")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
