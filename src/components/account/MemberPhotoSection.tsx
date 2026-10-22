"use client";

import { useEffect, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { Building2, Loader2 } from "lucide-react";
import { getMyPhoto, removeMyPhoto } from "@/app/actions/member-photo";
import { getMyLogo, removeMyLogo } from "@/app/actions/member-logo";
import {
  isRenderableMemberPhotoSrc,
  MEMBER_PHOTO_ACCEPT,
  MEMBER_PHOTO_MAX_BYTES,
  isMemberPhotoType,
  memberInitials,
} from "@/lib/membership/member-photo";
import { isRenderableMemberLogoSrc } from "@/lib/membership/member-logo";
import { downscaleLogo, downscalePhoto } from "@/lib/membership/photo-resize";

/**
 * Imagens do sócio na área logada. Sócio de plano comum: só a foto (como antes). Sócio de plano
 * EMPRESARIAL ('pj', lido no servidor): dois slots, "Logo da empresa" e "Foto".
 *
 * Os envios vão para POST /api/conta/foto (foto) e POST /api/conta/logo (logo); o servidor confere
 * sessão, sócio, plano, tamanho e magic bytes. A pré-checagem aqui é só para feedback rápido.
 * As URLs exibidas vêm do servidor já validadas e passam de novo pelo validador da tela.
 */
export function MemberPhotoSection({ name }: { name: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [canHaveLogo, setCanHaveLogo] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getMyPhoto(), getMyLogo()])
      .then(([photo, logo]) => {
        if (!alive) return;
        if (photo.ok) setPhotoUrl(photo.photoUrl);
        if (logo.ok) {
          setCanHaveLogo(logo.canHaveLogo);
          setLogoUrl(logo.logoUrl);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {canHaveLogo && (
        <ImageSlot
          kind="logo"
          title="Logo da empresa"
          url={logoUrl}
          onUrlChange={setLogoUrl}
          fallback={<Building2 size={28} aria-hidden="true" className="text-muted-foreground" />}
        />
      )}
      <ImageSlot
        kind="photo"
        title={canHaveLogo ? "Foto" : "Sua foto"}
        url={photoUrl}
        onUrlChange={setPhotoUrl}
        fallback={
          <span aria-hidden="true" className="text-xl font-semibold text-muted-foreground">
            {memberInitials(name)}
          </span>
        }
      />
    </>
  );
}

type SlotKind = "photo" | "logo";

/** O que muda entre foto (círculo, rosto) e logo (quadrado, inteiro, transparente). */
const SLOT = {
  photo: {
    endpoint: "/api/conta/foto",
    prepare: downscalePhoto,
    isRenderable: isRenderableMemberPhotoSrc,
    remove: removeMyPhoto,
    alt: "Sua foto de sócio",
    tooBig: "A foto deve ter no máximo 5 MB.",
    saved: "Foto salva.",
    removed: "Foto removida.",
    failed: "Não foi possível enviar a foto agora.",
    removeFailed: "Não foi possível remover a foto agora.",
    help: "JPEG, PNG ou WebP, até 5 MB. Com o rosto centralizado, a foto aparece redonda no Mural dos Sócios enquanto você estiver nele.",
  },
  logo: {
    endpoint: "/api/conta/logo",
    prepare: downscaleLogo,
    isRenderable: isRenderableMemberLogoSrc,
    remove: removeMyLogo,
    alt: "Logo da empresa",
    tooBig: "O logo deve ter no máximo 5 MB.",
    saved: "Logo salvo.",
    removed: "Logo removido.",
    failed: "Não foi possível enviar o logo agora.",
    removeFailed: "Não foi possível remover o logo agora.",
    help: "JPEG, PNG ou WebP, até 5 MB. Prefira PNG ou WebP com fundo transparente: o logo aparece inteiro no Mural e na carteirinha.",
  },
} as const;

/** Fundo xadrez: deixa ver a transparência do logo. */
const CHECKER_STYLE = {
  backgroundImage: "conic-gradient(#e4e4e7 25%, #ffffff 0 50%, #e4e4e7 0 75%, #ffffff 0)",
  backgroundSize: "16px 16px",
};

function ImageSlot({
  kind,
  title,
  url,
  onUrlChange,
  fallback,
}: {
  kind: SlotKind;
  title: string;
  url: string | null;
  onUrlChange: (url: string | null) => void;
  fallback: ReactNode;
}) {
  const cfg = SLOT[kind];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setFlash(null);
    if (!isMemberPhotoType(picked.type)) {
      setError("Envie uma imagem em JPEG, PNG ou WebP.");
      return;
    }

    setBusy(true);
    try {
      // Reduz no aparelho (limite da hospedagem ~4,5 MB; remove metadados). Logo: sem JPEG.
      const file = await cfg.prepare(picked);
      if (file.size > MEMBER_PHOTO_MAX_BYTES) {
        setError(cfg.tooBig);
        return;
      }
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(cfg.endpoint, { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; photoUrl?: unknown; logoUrl?: unknown; error?: string } | null;
      const newUrl = kind === "logo" ? data?.logoUrl : data?.photoUrl;
      if (res.ok && data?.ok === true && cfg.isRenderable(newUrl)) {
        onUrlChange(newUrl);
        setFlash(cfg.saved);
      } else {
        setError(data?.error ?? cfg.failed);
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
      const r = await cfg.remove();
      if (r.ok) {
        onUrlChange(null);
        setFlash(cfg.removed);
      } else {
        setError(r.error ?? cfg.removeFailed);
      }
    });
  }

  const busyAny = busy || isPending;
  const showImage = cfg.isRenderable(url);
  const isLogo = kind === "logo";

  return (
    <section className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>

      <div className="flex items-center gap-4">
        {isLogo ? (
          <div
            className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border flex items-center justify-center p-1"
            style={CHECKER_STYLE}
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={cfg.alt} width={72} height={72} className="max-h-full max-w-full object-contain" />
            ) : (
              fallback
            )}
          </div>
        ) : (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={cfg.alt} width={80} height={80} className="h-full w-full object-cover" />
            ) : (
              fallback
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-xs text-muted-foreground">{cfg.help}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold cursor-pointer ${
                busyAny ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {busy ? "Enviando..." : showImage ? (isLogo ? "Trocar logo" : "Trocar foto") : isLogo ? "Enviar logo" : "Enviar foto"}
              <input
                type="file"
                accept={MEMBER_PHOTO_ACCEPT}
                className="sr-only"
                disabled={busyAny}
                onChange={onPick}
                aria-label={isLogo ? "Escolher logo da empresa" : "Escolher foto de sócio"}
              />
            </label>
            {showImage && (
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
