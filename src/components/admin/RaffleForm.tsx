"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, X, Loader2, Trophy, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { createRaffle, updateRaffle, type RaffleRow, type RaffleStatus, type RafflePrizeRow } from "@/app/actions/admin-raffles";
import { RafflePrizesManager } from "@/components/admin/RafflePrizesManager";

function toSlug(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function reaisToCents(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function centsToReais(c: number): string {
  return (c / 100).toFixed(2).replace(".", ",");
}
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
/** Máscara de moeda estilo caixa: dígitos entram pela direita (150 → "1,50"). */
function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? centsToReais(parseInt(digits, 10)) : "";
}
function nowLocalInput(): string {
  return toLocalInput(new Date());
}

// Espelha o teto do servidor (RAFFLE_MAX_NUMBERS em admin-raffles.ts).
const RAFFLE_MAX_NUMBERS = 200_000;

const inputClass = "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "text-sm text-muted-foreground mb-1 block";

interface DraftPrize {
  name: string;
  description: string;
  imageUrl: string;
}

export function RaffleForm({ raffle, prizes }: { raffle?: RaffleRow; prizes?: RafflePrizeRow[] }) {
  const router = useRouter();
  const isEditing = !!raffle?.id;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"sorteio" | "premios">("sorteio");

  const [name, setName] = useState(raffle?.name ?? "");
  const [slug, setSlug] = useState(raffle?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(raffle?.description ?? "");
  const [images, setImages] = useState<string[]>(raffle?.imageUrls ?? []);
  const [price, setPrice] = useState(raffle ? centsToReais(raffle.numberPriceCents) : "");
  const [totalNumbers, setTotalNumbers] = useState(raffle ? String(raffle.totalNumbers) : "");
  const [maxPerCustomer, setMaxPerCustomer] = useState(raffle?.maxPerCustomer != null ? String(raffle.maxPerCustomer) : "");
  const [salesEndsAt, setSalesEndsAt] = useState(toLocalInput(raffle?.salesEndsAt ?? null));
  const [status, setStatus] = useState<RaffleStatus>(raffle?.status ?? "draft");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prêmios em rascunho (só no modo criação).
  const [draftPrizes, setDraftPrizes] = useState<DraftPrize[]>([]);

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
    const finalSlug = (slug || toSlug(name)).trim();

    const fail = (msg: string) => { setTab("sorteio"); setError(msg); return false; };

    if (!name.trim()) return fail("Informe o nome do sorteio.");
    if (!finalSlug) return fail("Informe um slug válido (use letras e números).");
    if (priceCents <= 0) return fail("Informe o valor do número (maior que R$ 0,00).");
    if (!isEditing) {
      if (!Number.isFinite(total) || total < 1) return fail("Informe a quantidade de números.");
      if (total > RAFFLE_MAX_NUMBERS) return fail(`Máximo de ${RAFFLE_MAX_NUMBERS.toLocaleString("pt-BR")} números por sorteio.`);
    }
    if (max != null) {
      if (!Number.isFinite(max) || max < 1) return fail("O limite por pessoa deve ser de ao menos 1 número.");
      if (!isEditing && Number.isFinite(total) && max > total) return fail("O limite por pessoa não pode ser maior que a quantidade de números.");
    }
    if (salesEndsAt) {
      const ends = new Date(salesEndsAt);
      if (Number.isNaN(ends.getTime())) return fail("Data de encerramento inválida.");
      if (!isEditing && ends.getTime() <= Date.now()) return fail("A data de encerramento das vendas deve ser no futuro.");
    }

    const common = {
      name: name.trim(),
      slug: finalSlug,
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
        const r = await createRaffle({
          ...common,
          totalNumbers: total,
          prizes: draftPrizes.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), description: p.description.trim() || null, imageUrl: p.imageUrl || null })),
        });
        if (!r.success) return setError(r.error ?? "Erro ao criar.");
        router.push(`/admin/rifas/${r.id}`);
      }
    });
  }

  return (
    <div className="max-w-2xl">
      {/* Abas */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["sorteio", "premios"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "sorteio" ? "Sorteio" : "Prêmios"}
          </button>
        ))}
      </div>

      {/* ── Aba Sorteio ── */}
      {tab === "sorteio" && (
        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClass}>Nome do sorteio</label>
            <input className={inputClass} value={name} maxLength={120} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(toSlug(e.target.value)); }} placeholder="Ex.: Rifa da Camisa Autografada" />
          </div>
          <div>
            <label className={labelClass}>Slug (URL)</label>
            <input className={inputClass} value={slug} onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugTouched(true); }} placeholder="rifa-da-camisa" />
            <p className="text-[11px] text-muted-foreground mt-1">Endereço público: /rifa/{slug || "..."}</p>
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea className={`${inputClass} min-h-[90px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do sorteio, regras, data do sorteio..." />
          </div>
          <div>
            <label className={labelClass}>Imagens (carrossel)</label>
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => (
                <div key={url + i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border bg-secondary/30">
                  <Image src={url} alt={`Imagem ${i + 1}`} fill className="object-cover" unoptimized />
                  <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80" title="Remover"><X size={12} /></button>
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
              <label className={labelClass}>Valor do número</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">R$</span>
                <input className={`${inputClass} pl-9 tabular-nums`} value={price} onChange={(e) => setPrice(maskBRL(e.target.value))} placeholder="0,00" inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Quantidade de números</label>
              <input
                className={`${inputClass} tabular-nums ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
                value={totalNumbers}
                onChange={(e) => setTotalNumbers(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="1000"
                inputMode="numeric"
                disabled={isEditing}
              />
              {isEditing ? (
                <p className="text-[11px] text-muted-foreground mt-1">Fixo após a criação.</p>
              ) : totalNumbers ? (
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{parseInt(totalNumbers, 10).toLocaleString("pt-BR")} números (máx. {RAFFLE_MAX_NUMBERS.toLocaleString("pt-BR")}).</p>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Limite por pessoa (opcional)</label>
              <input className={`${inputClass} tabular-nums`} value={maxPerCustomer} onChange={(e) => setMaxPerCustomer(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="sem limite" inputMode="numeric" />
            </div>
            <div>
              <label className={labelClass}>Encerra vendas em (opcional)</label>
              <input className={inputClass} type="datetime-local" value={salesEndsAt} min={isEditing ? undefined : nowLocalInput()} onChange={(e) => setSalesEndsAt(e.target.value)} />
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
        </div>
      )}

      {/* ── Aba Prêmios ── */}
      {tab === "premios" && (
        isEditing ? (
          <RafflePrizesManager raffleId={raffle!.id} prizes={prizes ?? []} />
        ) : (
          <DraftPrizesEditor prizes={draftPrizes} onChange={setDraftPrizes} />
        )
      )}

      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-5">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button type="button" onClick={submit} disabled={pending} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
          {pending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar sorteio"}
        </button>
        {!isEditing && tab === "sorteio" && (
          <button type="button" onClick={() => setTab("premios")} className="text-sm text-muted-foreground hover:text-foreground">
            Adicionar prêmios →
          </button>
        )}
      </div>
    </div>
  );
}

/** Editor de prêmios em memória (modo criação) — persistidos junto no submit. */
function DraftPrizesEditor({ prizes, onChange }: { prizes: DraftPrize[]; onChange: (p: DraftPrize[]) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "rifas");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setImageUrl(data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function add() {
    if (!name.trim()) return;
    onChange([...prizes, { name: name.trim(), description: description.trim(), imageUrl }]);
    setName(""); setDescription(""); setImageUrl("");
  }
  function remove(i: number) { onChange(prizes.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= prizes.length) return;
    const next = [...prizes];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {prizes.map((p, i) => (
          <li key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
            <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{i + 1}º</span>
            {p.imageUrl ? (
              <div className="relative w-12 h-12 rounded overflow-hidden border border-border shrink-0"><Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized /></div>
            ) : (
              <span className="shrink-0 w-12 h-12 rounded bg-secondary flex items-center justify-center text-muted-foreground/40"><Trophy size={18} /></span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30" title="Subir"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === prizes.length - 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30" title="Descer"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary" title="Remover"><Trash2 size={14} /></button>
            </div>
          </li>
        ))}
        {prizes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum prêmio ainda. Adicione abaixo (você também pode adicionar depois).</p>}
      </ul>

      <div className="bg-secondary/20 border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">Adicionar prêmio</p>
        <input className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nome do prêmio" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <input className={inputClass} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
        <div className="flex items-center gap-3">
          {imageUrl && <div className="relative w-14 h-14 rounded overflow-hidden border border-border"><Image src={imageUrl} alt="Prêmio" fill className="object-cover" unoptimized /></div>}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Enviando..." : imageUrl ? "Trocar imagem" : "Imagem (opcional)"}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={upload} />
          </label>
        </div>
        <button type="button" onClick={add} disabled={!name.trim()} className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 w-fit">
          <Plus size={15} /> Adicionar
        </button>
      </div>
    </div>
  );
}
