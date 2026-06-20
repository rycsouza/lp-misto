"use client";

import { useActionState } from "react";
import { createGame, updateGame } from "@/app/actions/admin";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ImageUpload } from "./ImageUpload";

type GameFormState =
  | { success: boolean; id?: string; error?: string }
  | undefined;

interface GameData {
  id?: string;
  season?: number;
  competition?: string;
  round?: string;
  date?: Date;
  isHome?: boolean;
  opponent?: string;
  opponentCrestUrl?: string | null;
  venue?: string;
  ticketPriceInteiraCents?: number | null;
  ticketPriceMeiaCents?: number | null;
  meiaEligibilityLabel?: string | null;
  active?: boolean;
}

interface GameFormProps {
  game?: GameData;
}

function toDatetimeLocal(date?: Date): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte um valor em reais (string do input) para centavos, ou null se vazio. */
function priceToCents(raw: FormDataEntryValue | null): number | null {
  const s = (raw as string | null)?.trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 100);
}

function centsToInput(cents?: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

export function GameForm({ game }: GameFormProps) {
  const router = useRouter();
  const isEditing = !!game?.id;

  async function handleCreate(
    _prev: GameFormState,
    formData: FormData
  ): Promise<GameFormState> {
    const data = {
      season: Number(formData.get("season")),
      competition: formData.get("competition") as string,
      round: formData.get("round") as string,
      date: new Date(formData.get("date") as string),
      isHome: formData.get("isHome") === "on",
      opponent: formData.get("opponent") as string,
      opponentCrestUrl: (formData.get("opponentCrestUrl") as string) || null,
      venue: formData.get("venue") as string,
      ticketPriceInteiraCents: priceToCents(formData.get("ticketPriceInteira")),
      ticketPriceMeiaCents: priceToCents(formData.get("ticketPriceMeia")),
      meiaEligibilityLabel:
        (formData.get("meiaEligibilityLabel") as string)?.trim() || null,
      active: formData.get("active") === "on",
    };
    return createGame(data);
  }

  async function handleUpdate(
    _prev: GameFormState,
    formData: FormData
  ): Promise<GameFormState> {
    const data = {
      season: Number(formData.get("season")),
      competition: formData.get("competition") as string,
      round: formData.get("round") as string,
      date: new Date(formData.get("date") as string),
      isHome: formData.get("isHome") === "on",
      opponent: formData.get("opponent") as string,
      opponentCrestUrl: (formData.get("opponentCrestUrl") as string) || null,
      venue: formData.get("venue") as string,
      ticketPriceInteiraCents: priceToCents(formData.get("ticketPriceInteira")),
      ticketPriceMeiaCents: priceToCents(formData.get("ticketPriceMeia")),
      meiaEligibilityLabel:
        (formData.get("meiaEligibilityLabel") as string)?.trim() || null,
      active: formData.get("active") === "on",
    };
    return updateGame(game!.id!, data);
  }

  const [state, action, pending] = useActionState<GameFormState, FormData>(
    isEditing ? handleUpdate : handleCreate,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      router.push("/admin/jogos");
    }
  }, [state, router]);

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            defaultValue={game?.season ?? new Date().getFullYear()}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="competition" className={labelClass}>
            Competição *
          </label>
          <input
            id="competition"
            name="competition"
            type="text"
            required
            maxLength={100}
            defaultValue={game?.competition ?? ""}
            className={inputClass}
            placeholder="Ex: Campeonato Sul-Mato-Grossense"
          />
        </div>

        <div>
          <label htmlFor="round" className={labelClass}>
            Rodada *
          </label>
          <input
            id="round"
            name="round"
            type="text"
            required
            maxLength={80}
            defaultValue={game?.round ?? ""}
            className={inputClass}
            placeholder="Ex: 3ª Rodada"
          />
        </div>

        <div>
          <label htmlFor="date" className={labelClass}>
            Data e Hora *
          </label>
          <input
            id="date"
            name="date"
            type="datetime-local"
            required
            defaultValue={toDatetimeLocal(game?.date)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="opponent" className={labelClass}>
            Adversário *
          </label>
          <input
            id="opponent"
            name="opponent"
            type="text"
            required
            maxLength={100}
            defaultValue={game?.opponent ?? ""}
            className={inputClass}
            placeholder="Nome do time adversário"
          />
        </div>

        <div>
          <ImageUpload
            name="opponentCrestUrl"
            defaultValue={game?.opponentCrestUrl}
            label="Brasão do Adversário (opcional)"
            folder="misto/jogos"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="venue" className={labelClass}>
            Local *
          </label>
          <input
            id="venue"
            name="venue"
            type="text"
            required
            maxLength={150}
            defaultValue={game?.venue ?? ""}
            className={inputClass}
            placeholder="Nome do estádio ou local"
          />
        </div>
      </div>

      {/* ── Preços do ingresso (por jogo) ──────────────────────────────── */}
      <div className="border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Ingressos deste jogo
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Deixe em branco para usar os valores e a regra de meia-entrada
          padrão configurados em Configurações → Ingressos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="ticketPriceInteira" className={labelClass}>
              Preço Inteira (R$)
            </label>
            <input
              id="ticketPriceInteira"
              name="ticketPriceInteira"
              type="number"
              step="0.01"
              min="0"
              defaultValue={centsToInput(game?.ticketPriceInteiraCents)}
              className={inputClass}
              placeholder="Usar valor padrão"
            />
          </div>
          <div>
            <label htmlFor="ticketPriceMeia" className={labelClass}>
              Preço Meia (R$)
            </label>
            <input
              id="ticketPriceMeia"
              name="ticketPriceMeia"
              type="number"
              step="0.01"
              min="0"
              defaultValue={centsToInput(game?.ticketPriceMeiaCents)}
              className={inputClass}
              placeholder="Usar valor padrão"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="meiaEligibilityLabel" className={labelClass}>
              Quem tem direito à meia-entrada
            </label>
            <textarea
              id="meiaEligibilityLabel"
              name="meiaEligibilityLabel"
              rows={2}
              maxLength={300}
              defaultValue={game?.meiaEligibilityLabel ?? ""}
              className={inputClass}
              placeholder="Ex: Idosos acima de 60 anos e estudantes com carteirinha (usar regra padrão se vazio)"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="isHome"
            defaultChecked={game?.isHome ?? true}
            className="w-4 h-4 rounded border-border bg-input"
          />
          Jogo em Casa
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={game?.active ?? true}
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
          className="bg-primary text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : "Salvar Jogo"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/jogos")}
          className="bg-secondary border border-border text-foreground rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
