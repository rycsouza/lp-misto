"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trophy, Trash2, Pencil, Upload, Loader2, Plus } from "lucide-react";
import {
  createRafflePrize,
  updateRafflePrize,
  deleteRafflePrize,
  type RafflePrizeRow,
} from "@/app/actions/admin-raffles";

const inputClass =
  "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";

export function RafflePrizesManager({
  raffleId,
  prizes,
}: {
  raffleId: string;
  prizes: RafflePrizeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
    setImageUrl("");
  }

  function startEdit(p: RafflePrizeRow) {
    setEditingId(p.id);
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
        await createRafflePrize({ raffleId, name: name.trim(), description: description.trim() || null, imageUrl: imageUrl || null, rank: prizes.length });
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Remover este prêmio?")) return;
    startTransition(async () => {
      await deleteRafflePrize(id);
      if (editingId === id) reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" style={{ opacity: pending ? 0.6 : 1, transition: "opacity 0.15s" }}>
      <ul className="flex flex-col gap-2">
        {prizes.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
            <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
              {i + 1}º
            </span>
            {p.imageUrl ? (
              <div className="relative w-12 h-12 rounded overflow-hidden border border-border shrink-0">
                <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <span className="shrink-0 w-12 h-12 rounded bg-secondary flex items-center justify-center text-muted-foreground/40">
                <Trophy size={18} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
              {p.winningNumber != null && (
                <p className="text-xs text-primary font-semibold mt-0.5">Ganhador: nº {p.winningNumber}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" title="Editar">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary" title="Remover">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {prizes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado.</p>}
      </ul>

      {/* Form add/edit */}
      <div className="bg-secondary/20 border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{editingId ? "Editar prêmio" : "Adicionar prêmio"}</p>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do prêmio (ex.: Camisa oficial autografada)" />
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
        <div className="flex items-center gap-3">
          {imageUrl && (
            <div className="relative w-14 h-14 rounded overflow-hidden border border-border">
              <Image src={imageUrl} alt="Prêmio" fill className="object-cover" unoptimized />
            </div>
          )}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? "Enviando..." : imageUrl ? "Trocar imagem" : "Imagem (opcional)"}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending || !name.trim()} className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            <Plus size={15} /> {editingId ? "Salvar" : "Adicionar"}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
