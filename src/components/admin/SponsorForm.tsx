"use client";

import { useActionState } from "react";
import { createSponsor, updateSponsor } from "@/app/actions/admin-content";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ImageUpload } from "./ImageUpload";

type SponsorFormState =
  | { success: boolean; id?: string; error?: string }
  | undefined;

interface SponsorData {
  id?: string;
  name?: string;
  logoUrl?: string;
  logoTone?: string;
  tier?: string;
  instagramUrl?: string | null;
  active?: boolean;
  order?: number;
}

interface SponsorFormProps {
  sponsor?: SponsorData;
}

export function SponsorForm({ sponsor }: SponsorFormProps) {
  const router = useRouter();
  const isEditing = !!sponsor?.id;

  async function handleCreate(
    _prev: SponsorFormState,
    formData: FormData
  ): Promise<SponsorFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      logoUrl: formData.get("logoUrl") as string,
      logoTone: formData.get("logoTone") as string,
      tier: formData.get("tier") as string,
      instagramUrl: (formData.get("instagramUrl") as string) || null,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return createSponsor(data);
  }

  async function handleUpdate(
    _prev: SponsorFormState,
    formData: FormData
  ): Promise<SponsorFormState> {
    const orderStr = formData.get("order") as string;
    const data = {
      name: formData.get("name") as string,
      logoUrl: formData.get("logoUrl") as string,
      logoTone: formData.get("logoTone") as string,
      tier: formData.get("tier") as string,
      instagramUrl: (formData.get("instagramUrl") as string) || null,
      active: formData.get("active") === "on",
      order: orderStr ? parseInt(orderStr, 10) : 0,
    };
    return updateSponsor(sponsor!.id!, data);
  }

  const [state, action, pending] = useActionState<SponsorFormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/patrocinadores");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const selectClass =
    "form-select w-full bg-input border border-border rounded-md pl-3 pr-9 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
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
            defaultValue={sponsor?.name ?? ""}
            className={inputClass}
            placeholder="Nome do patrocinador"
          />
        </div>

        <div className="sm:col-span-2">
          <ImageUpload
            name="logoUrl"
            defaultValue={sponsor?.logoUrl}
            label="Logo *"
            folder="misto/patrocinadores"
            required
          />
        </div>

        <div>
          <label htmlFor="logoTone" className={labelClass}>
            Tom do Logo *
          </label>
          <select
            id="logoTone"
            name="logoTone"
            required
            defaultValue={sponsor?.logoTone ?? "light"}
            className={selectClass}
          >
            <option value="light">Light (fundo escuro)</option>
            <option value="dark">Dark (fundo claro)</option>
          </select>
        </div>

        <div>
          <label htmlFor="tier" className={labelClass}>
            Tier *
          </label>
          <select
            id="tier"
            name="tier"
            required
            defaultValue={sponsor?.tier ?? ""}
            className={selectClass}
          >
            <option value="">Selecione...</option>
            <option value="diamante">Diamante</option>
            <option value="ouro">Ouro</option>
            <option value="prata">Prata</option>
            <option value="bronze">Bronze</option>
          </select>
        </div>

        <div>
          <label htmlFor="instagramUrl" className={labelClass}>
            URL do Instagram
          </label>
          <input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            defaultValue={sponsor?.instagramUrl ?? ""}
            className={inputClass}
            placeholder="https://instagram.com/..."
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
            defaultValue={sponsor?.order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={sponsor?.active ?? true}
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
          {pending ? "Salvando..." : "Salvar Patrocinador"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/patrocinadores")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
