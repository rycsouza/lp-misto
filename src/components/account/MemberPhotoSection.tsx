"use client";

import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { getMyPhoto, removeMyPhoto } from "@/app/actions/member-photo";
import {
  isRenderableMemberPhotoSrc,
  MEMBER_PHOTO_ACCEPT,
  MEMBER_PHOTO_MAX_BYTES,
  isMemberPhotoType,
  memberInitials,
} from "@/lib/membership/member-photo";
import { downscalePhoto } from "@/lib/membership/photo-resize";

/**
 * "Sua foto" na área do sócio. O envio vai para POST /api/conta/foto (o servidor confere
 * sessão, sócio, tamanho e magic bytes). A pré-checagem aqui é só para dar feedback rápido.
 * A URL exibida vem do servidor já validada; só o formato de entrega passa na tela.
 */
export function MemberPhotoSection({ name }: { name: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getMyPhoto()
      .then((r) => {
        if (alive && r.ok) setPhotoUrl(r.photoUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setFlash(null);
    if (!isMemberPhotoType(picked.type)) {
      setError("Envie uma foto em JPEG, PNG ou WebP.");
      return;
    }

    setBusy(true);
    try {
      // Reduz no aparelho (limite da hospedagem ~4,5 MB e remove dados de GPS da câmera).
      const file = await downscalePhoto(picked);
      if (file.size > MEMBER_PHOTO_MAX_BYTES) {
        setError("A foto deve ter no máximo 5 MB.");
        return;
      }
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/conta/foto", { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; photoUrl?: unknown; error?: string } | null;
      if (res.ok && data?.ok === true && isRenderableMemberPhotoSrc(data.photoUrl)) {
        setPhotoUrl(data.photoUrl);
        setFlash("Foto salva.");
      } else {
        setError(data?.error ?? "Não foi possível enviar a foto agora.");
      }
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function onRemove() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const r = await removeMyPhoto();
      if (r.ok) {
        setPhotoUrl(null);
        setFlash("Foto removida.");
      } else {
        setError(r.error ?? "Não foi possível remover a foto agora.");
      }
    });
  }

  const busyAny = busy || isPending;
  const showPhoto = isRenderableMemberPhotoSrc(photoUrl);

  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">Sua foto</p>

      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Sua foto de sócio" width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-xl font-semibold text-muted-foreground">
              {memberInitials(name)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-xs text-muted-foreground">
            JPEG, PNG ou WebP, até 5 MB. Com o rosto centralizado, a foto aparece redonda no Mural dos Sócios enquanto você estiver nele.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold cursor-pointer ${
                busyAny ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {busy ? "Enviando..." : showPhoto ? "Trocar foto" : "Enviar foto"}
              <input
                type="file"
                accept={MEMBER_PHOTO_ACCEPT}
                className="sr-only"
                disabled={busyAny}
                onChange={onPick}
                aria-label="Escolher foto de sócio"
              />
            </label>
            {showPhoto && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busyAny}
                className="px-3 py-2 text-sm text-muted-foreground underline disabled:opacity-50"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      {flash && (
        <p className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-sm text-foreground">{flash}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
