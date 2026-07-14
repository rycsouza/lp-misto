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
  aspectRatio?: string; // e.g. "1:1", "4:3" — validates before upload
}

/**
 * Recomendação por proporção — evita dica contraditória (ex.: hero 16:9 não deve
 * sugerir 1000×1000 nem "PNG transparente", que só faz sentido pra logo/favicon).
 */
const ASPECT_RECOMMENDATION: Record<string, { size: string; kind: string }> = {
  "1:1": { size: "1000×1000 px", kind: "PNG transparente ou fundo escuro" },
  "16:9": { size: "1920×1080 px", kind: "JPG ou PNG" },
  "4:3": { size: "1200×900 px", kind: "JPG ou PNG" },
  "3:4": { size: "900×1200 px", kind: "JPG ou PNG" },
};

function aspectRecommendation(aspectRatio?: string) {
  if (!aspectRatio) return null;
  return ASPECT_RECOMMENDATION[aspectRatio] ?? { size: "", kind: "JPG ou PNG" };
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("Não foi possível ler a imagem."));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function ImageUpload({ name, defaultValue, label, folder = "misto", required, aspectRatio }: Props) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Aspect ratio validation before upload
    if (aspectRatio) {
      try {
        const [rw, rh] = aspectRatio.split(":").map(Number);
        const expected = rw / rh;
        const { width, height } = await getImageDimensions(file);
        const actual = width / height;
        const tolerance = 0.05; // 5% de margem
        if (Math.abs(actual - expected) / expected > tolerance) {
          const ex = aspectRecommendation(aspectRatio)?.size;
          setError(
            `Proporção incorreta: sua imagem é ${width}×${height}px. ` +
            `Envie uma imagem na proporção ${aspectRatio}${ex ? ` (ex: ${ex})` : ""}.`
          );
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
      } catch {
        setError("Não foi possível verificar a proporção da imagem.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }

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

  const isSquare = aspectRatio === "1:1";

  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelClass}>{label}</span>}

      {/* Hidden input submitted with the form */}
      <input type="hidden" name={name} value={url} required={required && !url} />

      {/* Preview thumbnail */}
      {url && (
        <div className={`relative rounded-lg overflow-hidden border border-border bg-secondary/30 flex-shrink-0 ${isSquare ? "w-24 h-24" : "w-28 h-20"}`}>
          <Image
            src={url}
            alt="Preview"
            fill
            className="object-contain p-1"
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

      {aspectRatio && !error && (() => {
        const reco = aspectRecommendation(aspectRatio);
        return (
          <p className="text-[11px] text-muted-foreground">
            Proporção obrigatória: <strong>{aspectRatio}</strong>
            {reco?.size ? ` — recomendado ${reco.size}` : ""}, {reco?.kind ?? "JPG ou PNG"}.
          </p>
        );
      })()}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
