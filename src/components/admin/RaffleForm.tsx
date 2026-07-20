"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { createRaffle, updateRaffle, type RaffleRow, type RaffleStatus } from "@/app/actions/admin-raffles";

function toSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function reaisToCents(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToReais(c: number): string {
  return (c / 100).toFixed(2).replace(".", ",");
}

/** datetime-local (yyyy-MM-ddTHH:mm) a partir de Date, no fuso local. */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const inputClass =
  "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm text-muted-foreground mb-1 block";

export function RaffleForm({ raffle }: { raffle?: RaffleRow }) {
  const router = useRouter();
  const isEditing = !!raffle?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(raffle?.name ?? "");
  const [slug, setSlug] = useState(raffle?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(raffle?.description ?? "");
  const [images, setImages] = useState<string[]>(raffle?.imageUrls ?? []);
  const [price, setPrice] = useState(raffle ? centsToReais(raffle.numberPriceCents) : "");
  const [totalNumbers, setTotalNumbers] = useState(raffle ? String(raffle.totalNumbers) : "");
  const [maxPerCustomer, setMaxPerCustomer] = useState(
    raffle?.maxPerCustomer != null ? String(raffle.maxPerCustomer) : ""
  );
  const [salesEndsAt, setSalesEndsAt] = useState(toLocalInput(raffle?.salesEndsAt ?? null));
  const [status, setStatus] = useState<RaffleStatus>(raffle?.status ?? "draft");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "rifas");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.url) setImages((prev) => [...prev, data.url]);
        else setError(data.error ?? "Erro ao enviar imagem.");
      }
    } catch {
      setError("Falha ao enviar imagem.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    setError(null);
    const priceCents = reaisToCents(price);
    const total = parseInt(totalNumbers, 10);
    const max = maxPerCustomer.trim() ? parseInt(maxPerCustomer, 10) : null;

    if (!name.trim()) return setError("Informe o nome do sorteio.");
    if (priceCents <= 0) return setError("Informe o valor do número.");
    if (!isEditing && (!Number.isFinite(total) || total < 1)) return setError("Informe a quantidade de números.");

    const common = {
      name: name.trim(),
      slug: (slug || toSlug(name)).trim(),
      description: description.trim() || null,
      imageUrls: images,
      numberPriceCents: priceCents,
      maxPerCustomer: max,
      salesEndsAt: salesEndsAt ? new Date(salesEndsAt) : null,
      status,
    };

    startTransition(async () => {
      if (isEditing) {
        const r = await updateRaffle(raffle!.id, common);
        if (!r.success) return setError(r.error ?? "Erro ao salvar.");
        router.refresh();
      } else {
        const r = await createRaffle({ ...common, totalNumbers: total });
        if (!r.success) return setError(r.error ?? "Erro ao criar.");
        router.push(`/admin/rifas/${r.id}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <label className={labelClass}>Nome do sorteio</label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          placeholder="Ex.: Rifa da Camisa Autografada"
        />
      </div>

      <div>
        <label className={labelClass}>Slug (URL)</label>
        <input
          className={inputClass}
          value={slug}
          onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugTouched(true); }}
          placeholder="rifa-da-camisa"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Endereço público: /rifa/{slug || "..."}</p>
      </div>

      <div>
        <label className={labelClass}>Descrição</label>
        <textarea
          className={`${inputClass} min-h-[90px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes do sorteio, regras, data do sorteio..."
        />
      </div>

      {/* Carrossel de imagens */}
      <div>
        <label className={labelClass}>Imagens (carrossel)</label>
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={url + i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border bg-secondary/30">
              <Image src={url} alt={`Imagem ${i + 1}`} fill className="object-cover" unoptimized />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                title="Remover"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="w-24 h-24 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            <span className="text-[10px]">{uploading ? "Enviando" : "Adicionar"}</span>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Valor do número (R$)</label>
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="10,00" inputMode="decimal" />
        </div>
        <div>
          <label className={labelClass}>Quantidade de números</label>
          <input
            className={`${inputClass} ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
            value={totalNumbers}
            onChange={(e) => setTotalNumbers(e.target.value.replace(/\D/g, ""))}
            placeholder="1000"
            inputMode="numeric"
            disabled={isEditing}
          />
          {isEditing && <p className="text-[11px] text-muted-foreground mt-1">Fixo após a criação.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Limite por pessoa (opcional)</label>
          <input className={inputClass} value={maxPerCustomer} onChange={(e) => setMaxPerCustomer(e.target.value.replace(/\D/g, ""))} placeholder="sem limite" inputMode="numeric" />
        </div>
        <div>
          <label className={labelClass}>Encerra vendas em (opcional)</label>
          <input className={inputClass} type="datetime-local" value={salesEndsAt} onChange={(e) => setSalesEndsAt(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Situação</label>
        <select className={`form-select ${inputClass}`} value={status} onChange={(e) => setStatus(e.target.value as RaffleStatus)}>
          <option value="draft">Rascunho (não visível)</option>
          <option value="active">À venda</option>
          <option value="closed">Vendas encerradas</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar sorteio"}
        </button>
        {!isEditing && (
          <p className="text-xs text-muted-foreground">Depois de criar, você adiciona os prêmios.</p>
        )}
      </div>
    </div>
  );
}
