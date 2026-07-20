"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trophy, Trash2, Pencil, Upload, Loader2, Plus, Award, X, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { useDragReorder } from "@/components/admin/useDragReorder";
import { useConfirm } from "@/components/admin/useConfirm";
import {
  createRafflePrize,
  updateRafflePrize,
  deleteRafflePrize,
  drawRaffleWinner,
  clearRaffleWinner,
  reorderRafflePrizes,
  type RafflePrizeRow,
} from "@/app/actions/admin-raffles";

const inputClass =
  "w-full bg-input border border-border rounded-lg px-3.5 py-2.5 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
const iconBtn =
  "w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

export function RafflePrizesManager({
  raffleId,
  prizes,
}: {
  raffleId: string;
  prizes: RafflePrizeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { rows, isSaving, move } = useDragReorder(prizes, reorderRafflePrizes);
  const { confirm, dialog } = useConfirm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sorteio (definir ganhador)
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [drawNumber, setDrawNumber] = useState("");
  const [drawPhoto, setDrawPhoto] = useState("");
  const [drawUploading, setDrawUploading] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const drawFileRef = useRef<HTMLInputElement>(null);

  const formOpen = editingId !== null || showForm || rows.length === 0;
  const busy = pending || isSaving;

  function startDraw(p: RafflePrizeRow) {
    setDrawingId(p.id);
    setDrawNumber(p.winningNumber != null ? String(p.winningNumber) : "");
    setDrawPhoto(p.winnerPhotoUrl ?? "");
    setDrawError(null);
  }

  async function handleDrawPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDrawUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "rifas");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setDrawPhoto(data.url);
    } finally {
      setDrawUploading(false);
      if (drawFileRef.current) drawFileRef.current.value = "";
    }
  }

  function confirmDraw(prizeId: string) {
    const n = parseInt(drawNumber, 10);
    if (!Number.isFinite(n) || n < 1) { setDrawError("Informe o número sorteado."); return; }
    setDrawError(null);
    startTransition(async () => {
      const r = await drawRaffleWinner(prizeId, n, drawPhoto || null);
      if (!r.success) { setDrawError(r.error ?? "Erro ao definir ganhador."); return; }
      setDrawingId(null);
      router.refresh();
    });
  }

  function clearWinner(prizeId: string) {
    confirm({
      title: "Remover o ganhador deste prêmio?",
      description: "O prêmio volta a ficar sem ganhador. Se o sorteio estava apurado, ele reabre.",
      confirmLabel: "Remover ganhador",
      onConfirm: () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            await clearRaffleWinner(prizeId);
            setDrawingId(null);
            router.refresh();
            resolve();
          });
        }),
    });
  }

  function reset() {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setDescription("");
    setImageUrl("");
  }

  function startEdit(p: RafflePrizeRow) {
    setEditingId(p.id);
    setShowForm(true);
    setName(p.name);
    setDescription(p.description ?? "");
    setImageUrl(p.imageUrl ?? "");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

  function save() {
    if (!name.trim()) return;
    startTransition(async () => {
      if (editingId) {
        await updateRafflePrize(editingId, { name: name.trim(), description: description.trim() || null, imageUrl: imageUrl || null });
      } else {
        await createRafflePrize({ raffleId, name: name.trim(), description: description.trim() || null, imageUrl: imageUrl || null, rank: rows.length });
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    confirm({
      title: "Remover este prêmio?",
      confirmLabel: "Remover",
      onConfirm: () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            await deleteRafflePrize(id);
            if (editingId === id) reset();
            router.refresh();
            resolve();
          });
        }),
    });
  }

  return (
    <div className="flex flex-col gap-4" style={{ opacity: busy ? 0.6 : 1, transition: "opacity 0.15s" }}>
      {/* Lista de prêmios */}
      <ul className="flex flex-col gap-2.5">
        {rows.map((p, i) => {
          const hasWinner = p.winningNumber != null;
          const isDrawing = drawingId === p.id;
          return (
            <li
              key={p.id}
              className={`rounded-xl border p-3 sm:p-4 flex flex-col gap-3 ${
                hasWinner ? "border-primary/40 bg-primary/5" : "bg-card border-border"
              }`}
            >
              {/* Cabeçalho do prêmio */}
              <div className="flex items-center gap-3">
                {/* Reordenar (setas — funcionam no toque) */}
                <div className="shrink-0 flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy} className={`${iconBtn} h-7 text-muted-foreground hover:text-foreground hover:bg-secondary`} aria-label="Subir">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy} className={`${iconBtn} h-7 text-muted-foreground hover:text-foreground hover:bg-secondary`} aria-label="Descer">
                    <ArrowDown size={15} />
                  </button>
                </div>

                <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold tabular-nums">
                  {i + 1}º
                </span>

                {p.imageUrl ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0">
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <span className="shrink-0 w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground/40">
                    <Trophy size={18} />
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                </div>
              </div>

              {/* Faixa de ganhador */}
              {hasWinner && (
                <div className="flex items-center gap-2.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                  {p.winnerPhotoUrl ? (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-primary/30 shrink-0">
                      <Image src={p.winnerPhotoUrl} alt="Ganhador" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <Award size={16} className="text-primary shrink-0" />
                  )}
                  <p className="text-xs text-primary font-semibold">
                    Ganhador definido · nº {p.winningNumber}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center gap-2 border-t border-border/60 pt-2.5">
                <button
                  type="button"
                  onClick={() => (isDrawing ? setDrawingId(null) : startDraw(p))}
                  className={`flex items-center gap-1.5 rounded-lg px-3 h-9 text-sm font-medium transition-colors ${
                    hasWinner
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  <Award size={15} />
                  {hasWinner ? "Ver ganhador" : "Definir ganhador"}
                </button>

                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => startEdit(p)} className={`${iconBtn} text-muted-foreground hover:text-foreground hover:bg-secondary`} title="Editar" aria-label="Editar prêmio">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className={`${iconBtn} text-muted-foreground hover:text-destructive hover:bg-secondary`} title="Remover" aria-label="Remover prêmio">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Painel: definir ganhador */}
              {isDrawing && (
                <div className="border-t border-border pt-3 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-foreground">Definir ganhador</p>
                  <input
                    className={inputClass}
                    value={drawNumber}
                    onChange={(e) => setDrawNumber(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    placeholder="Número sorteado"
                    inputMode="numeric"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border text-sm cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground">
                      {drawUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {drawPhoto ? "Trocar foto" : "Foto do ganhador"}
                      <input ref={drawFileRef} type="file" accept="image/*" className="hidden" disabled={drawUploading} onChange={handleDrawPhoto} />
                    </label>
                    {drawPhoto && (
                      <span className="relative w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0">
                        <Image src={drawPhoto} alt="Ganhador" fill className="object-cover" unoptimized />
                        <button type="button" onClick={() => setDrawPhoto("")} className="absolute -top-1 -right-1 bg-black/70 text-white rounded-full p-0.5"><X size={10} /></button>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Só números já vendidos são aceitos.</p>
                  {drawError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{drawError}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => confirmDraw(p.id)} disabled={busy} className="bg-primary text-primary-foreground rounded-lg px-4 h-10 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                      {hasWinner ? "Atualizar ganhador" : "Confirmar ganhador"}
                    </button>
                    {hasWinner && (
                      <button type="button" onClick={() => clearWinner(p.id)} className="text-sm text-destructive hover:underline px-2 h-10">
                        Remover ganhador
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum prêmio cadastrado ainda. Adicione o primeiro abaixo.
          </li>
        )}
      </ul>

      {/* Botão para abrir o formulário (quando já há prêmios e não está editando) */}
      {!formOpen && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus size={16} /> Adicionar prêmio
        </button>
      )}

      {/* Formulário adicionar/editar */}
      {formOpen && (
        <div className="bg-secondary/20 border border-border rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{editingId ? "Editar prêmio" : "Novo prêmio"}</p>
            {rows.length > 0 && (
              <button type="button" onClick={reset} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
                <ChevronDown size={18} />
              </button>
            )}
          </div>
          <input className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nome do prêmio (ex.: Camisa oficial autografada)" />
          <input className={inputClass} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
          <div className="flex items-center gap-3">
            {imageUrl && (
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                <Image src={imageUrl} alt="Prêmio" fill className="object-cover" unoptimized />
              </div>
            )}
            <label className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-border text-sm cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? "Enviando..." : imageUrl ? "Trocar imagem" : "Imagem (opcional)"}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={save} disabled={busy || !name.trim()} className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 h-10 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              <Plus size={15} /> {editingId ? "Salvar prêmio" : "Adicionar prêmio"}
            </button>
            {(editingId || rows.length > 0) && (
              <button type="button" onClick={reset} className="text-sm text-muted-foreground hover:text-foreground px-3 h-10">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
}
