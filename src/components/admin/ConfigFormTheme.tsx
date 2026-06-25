"use client";

import { useState, useTransition } from "react";
import { updateConfigValues } from "@/app/actions/admin";
import { Check, Loader2, RotateCcw } from "lucide-react";

// Padrões do globals.css — usados no preview e no reset
const DEFAULT_PRIMARY = "#c19a5a";
const DEFAULT_ACCENT  = "#d4643a";

interface Props {
  primaryColor: string;
  accentColor: string;
}

export function ConfigFormTheme({ primaryColor: initialPrimary, accentColor: initialAccent }: Props) {
  const [primary, setPrimary] = useState(initialPrimary || DEFAULT_PRIMARY);
  const [accent, setAccent]   = useState(initialAccent  || DEFAULT_ACCENT);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      // Salva vazio quando é igual ao default — evita override desnecessário
      await updateConfigValues({
        primaryColor: primary === DEFAULT_PRIMARY ? "" : primary,
        accentColor:  accent  === DEFAULT_ACCENT  ? "" : accent,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function handleReset() {
    setPrimary(DEFAULT_PRIMARY);
    setAccent(DEFAULT_ACCENT);
  }

  const changed =
    (primary !== DEFAULT_PRIMARY || accent !== DEFAULT_ACCENT) ||
    (initialPrimary !== "" || initialAccent !== "");

  return (
    <div className="flex flex-col gap-6">
      {/* Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <ColorField
          label="Cor primária"
          description="Botões, links ativos, destaques"
          value={primary}
          onChange={setPrimary}
          defaultValue={DEFAULT_PRIMARY}
        />
        <ColorField
          label="Cor de destaque"
          description="Badges, alertas, elementos secundários"
          value={accent}
          onChange={setAccent}
          defaultValue={DEFAULT_ACCENT}
        />
      </div>

      {/* Preview ao vivo */}
      <div className="border border-border rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            style={{ background: primary, color: "#000" }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Comprar ingresso
          </button>
          <button
            style={{ borderColor: primary, color: primary }}
            className="px-4 py-2 rounded-lg text-sm font-semibold border-2 bg-transparent"
          >
            Ver detalhes
          </button>
          <span
            style={{ background: accent, color: "#fff" }}
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          >
            Destaque
          </span>
          <div
            style={{ borderColor: primary }}
            className="w-5 h-5 rounded border-2"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Salvando…</>
          ) : saved ? (
            <><Check size={14} /> Salvo!</>
          ) : (
            "Salvar cores"
          )}
        </button>
        {changed && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={13} /> Restaurar padrão
          </button>
        )}
      </div>
    </div>
  );
}

function ColorField({
  label,
  description,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="relative cursor-pointer">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <div
            className="w-10 h-10 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-105"
            style={{ background: value }}
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="w-28 bg-input border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-ring uppercase"
        />
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Restaurar esta cor"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
