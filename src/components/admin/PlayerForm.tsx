"use client";

import { useActionState } from "react";
import { createPlayer, updatePlayer } from "@/app/actions/admin-content";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type PlayerFormState =
  | { success: boolean; id?: string; error?: string }
  | undefined;

interface PlayerData {
  id?: string;
  name?: string;
  number?: number | null;
  position?: string;
  photoUrl?: string | null;
  season?: number;
  active?: boolean;
}

interface PlayerFormProps {
  player?: PlayerData;
  defaultSeason?: number;
}

export function PlayerForm({ player, defaultSeason }: PlayerFormProps) {
  const router = useRouter();
  const isEditing = !!player?.id;

  async function handleCreate(
    _prev: PlayerFormState,
    formData: FormData
  ): Promise<PlayerFormState> {
    const numberStr = formData.get("number") as string;
    const data = {
      name: formData.get("name") as string,
      number: numberStr ? parseInt(numberStr, 10) : null,
      position: formData.get("position") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      season: parseInt(formData.get("season") as string, 10),
      active: formData.get("active") === "on",
    };
    return createPlayer(data);
  }

  async function handleUpdate(
    _prev: PlayerFormState,
    formData: FormData
  ): Promise<PlayerFormState> {
    const numberStr = formData.get("number") as string;
    const data = {
      name: formData.get("name") as string,
      number: numberStr ? parseInt(numberStr, 10) : null,
      position: formData.get("position") as string,
      photoUrl: (formData.get("photoUrl") as string) || null,
      season: parseInt(formData.get("season") as string, 10),
      active: formData.get("active") === "on",
    };
    return updatePlayer(player!.id!, data);
  }

  const [state, action, pending] = useActionState<PlayerFormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/elenco");
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
            defaultValue={player?.name ?? ""}
            className={inputClass}
            placeholder="Nome completo do jogador"
          />
        </div>

        <div>
          <label htmlFor="number" className={labelClass}>
            Número
          </label>
          <input
            id="number"
            name="number"
            type="number"
            min={1}
            max={99}
            defaultValue={player?.number ?? ""}
            className={inputClass}
            placeholder="Ex: 10"
          />
        </div>

        <div>
          <label htmlFor="position" className={labelClass}>
            Posição *
          </label>
          <select
            id="position"
            name="position"
            required
            defaultValue={player?.position ?? ""}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            <option value="goleiro">Goleiro</option>
            <option value="zagueiro">Zagueiro</option>
            <option value="lateral">Lateral</option>
            <option value="volante">Volante</option>
            <option value="meia">Meia</option>
            <option value="atacante">Atacante</option>
          </select>
        </div>

        <div>
          <label htmlFor="season" className={labelClass}>
            Temporada *
          </label>
          <input
            id="season"
            name="season"
            type="number"
            required
            min={2000}
            max={2100}
            defaultValue={player?.season ?? defaultSeason ?? new Date().getFullYear()}
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
            defaultValue={player?.photoUrl ?? ""}
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
            defaultChecked={player?.active ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Ativo (exibir no elenco)
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
          {pending ? "Salvando..." : "Salvar Jogador"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/elenco")}
          className="bg-secondary text-foreground rounded-md px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
