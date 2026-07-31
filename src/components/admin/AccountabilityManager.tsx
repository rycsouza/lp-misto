"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";
import {
  createAccountabilityReport,
  deleteAccountabilityReport,
  type AccountabilityReportRow,
} from "@/app/actions/admin-institutional";
import { useConfirm } from "@/components/admin/useConfirm";
import { toDownloadUrl } from "@/lib/cloudinary-download";

export function AccountabilityManager({ initial }: { initial: AccountabilityReportRow[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "prestacao-contas");
      const res = await fetch("/api/upload/document", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar o PDF.");
      } else {
        setFileUrl(data.url);
        setFileName(file.name);
        if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ""));
      }
    } catch {
      setError("Falha na conexão.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await createAccountabilityReport({ title, fileUrl });
      if (!res.success) {
        setError(res.error ?? "Erro ao salvar.");
        return;
      }
      setTitle("");
      setFileUrl("");
      setFileName("");
      router.refresh();
    });
  }

  function handleDelete(r: AccountabilityReportRow) {
    confirm({
      title: `Remover "${r.title}"?`,
      description: "O documento deixa de aparecer no site. Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      onConfirm: () =>
        startTransition(async () => {
          await deleteAccountabilityReport(r.id);
          router.refresh();
        }),
    });
  }

  const inputClass =
    "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

  return (
    <div className="flex flex-col gap-4">
      {/* Formulário de upload */}
      <div className="border border-border rounded-xl p-4 bg-secondary/20 flex flex-col gap-3">
        <input
          className={inputClass}
          placeholder="Título (ex: Prestação de contas — Janeiro/2025)"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm transition-colors ${
                uploading ? "bg-secondary/50 text-muted-foreground cursor-wait" : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <Upload size={13} />
              {uploading ? "Enviando..." : fileUrl ? "Trocar PDF" : "Enviar PDF"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleFile}
            />
          </label>
          {fileUrl && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <FileText size={14} className="text-primary shrink-0" />
              <span className="truncate max-w-[200px]">{fileName || "PDF enviado"}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || uploading || !title.trim() || !fileUrl}
            className="ml-auto bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Adicionar
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Lista */}
      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
          Nenhum documento publicado ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {initial.map((r) => (
            <li key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
              <FileText size={18} className="text-primary shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-foreground truncate">{r.title}</span>
              <a
                href={toDownloadUrl(r.fileUrl, r.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Baixar PDF"
              >
                <ExternalLink size={15} />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(r)}
                disabled={isPending}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors disabled:opacity-50"
                title="Remover"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  );
}
