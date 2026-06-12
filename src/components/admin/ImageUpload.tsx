"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import Image from "next/image";

interface Props {
  name: string;
  defaultValue?: string | null;
  label?: string;
  folder?: string;
  required?: boolean;
}

export function ImageUpload({ name, defaultValue, label, folder = "misto", required }: Props) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar imagem.");
      } else {
        setUrl(data.url);
      }
    } catch {
      setError("Falha na conexão.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const inputClass =
    "w-full bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "text-sm text-muted-foreground mb-1 block";

  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelClass}>{label}</span>}

      {/* Hidden input submitted with the form */}
      <input type="hidden" name={name} value={url} required={required && !url} />

      {/* Preview thumbnail */}
      {url && (
        <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-border bg-secondary/30 flex-shrink-0">
          <Image
            src={url}
            alt="Preview"
            fill
            className="object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition-colors"
            title="Remover imagem"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Upload button */}
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <span
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm transition-colors",
            uploading
              ? "bg-secondary/50 text-muted-foreground cursor-wait"
              : "bg-secondary text-foreground hover:bg-secondary/80",
          ].join(" ")}
        >
          <Upload size={13} />
          {uploading ? "Enviando..." : url ? "Trocar imagem" : "Enviar imagem"}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={handleFile}
        />
      </label>

      {/* URL manual fallback */}
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="ou cole uma URL diretamente..."
        className={`${inputClass} text-xs`}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
