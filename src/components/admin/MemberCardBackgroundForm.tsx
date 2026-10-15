"use client";

import { useId, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { updateMemberCardBackgroundAdmin } from "@/app/actions/membership";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { MemberCard } from "@/components/membership/MemberCard";
import type { MemberCardData } from "@/lib/membership/card-data";
import {
  CARD_BACKGROUND_OPACITY_MAX,
  CARD_BACKGROUND_OPACITY_MIN,
  safeCardBackgroundUrl,
  type CardBackgroundFit,
} from "@/lib/membership/card-background";

export interface MemberCardBackgroundPlan {
  id: string;
  name: string;
  cardColor: string | null;
}

interface Props {
  initial: { url: string; fit: CardBackgroundFit; opacity: number };
  /** Planos ativos: cada um aparece na prévia com a própria cor. */
  plans: MemberCardBackgroundPlan[];
  /** Cor primária do clube (fallback dos planos sem cor própria). */
  clubColor: string | null;
  siteName: string;
  /** Bucket de upload: só URL desse destino passa (igual ao servidor). */
  uploadCloudName: string | null;
}

const FIT_OPTIONS: { value: CardBackgroundFit; label: string; hint: string }[] = [
  { value: "cover", label: "Preencher", hint: "Cobre o cartão inteiro; pode cortar as bordas." },
  { value: "contain", label: "Caber inteira", hint: "Mostra a imagem toda; pode sobrar faixa." },
];

// Datas fixas: a prévia não depende do relógio (evita diferença entre servidor e cliente).
const PREVIEW_MEMBER_SINCE = "2026-03-01T12:00:00.000Z";
const PREVIEW_NEXT_BILLING = "2026-11-10T12:00:00.000Z";

function previewCard(
  plan: MemberCardBackgroundPlan | null,
  clubColor: string | null,
  background: MemberCardData["background"],
): MemberCardData {
  return {
    name: "NOME DO SÓCIO",
    planName: plan?.name ?? "Plano",
    status: "active",
    memberSince: PREVIEW_MEMBER_SINCE,
    nextBillingDate: PREVIEW_NEXT_BILLING,
    cardColor: plan?.cardColor ?? null,
    clubColor,
    clubLogoUrl: null,
    background,
    benefits: [],
    hasDiscounts: false,
    hasBenefits: true,
    // Prévia: valor fictício, nenhum QR de sócio real.
    qrValue: "previa-carteirinha",
    memberCode: null,
  };
}

/**
 * Visual da carteirinha (admin do módulo socios): imagem de fundo do clube, ajuste,
 * opacidade e prévia com cada cor de plano. Só a action específica grava (valida tudo no
 * servidor). A prévia usa o mesmo critério de URL, então o que aparece é o que será salvo.
 */
export function MemberCardBackgroundForm({ initial, plans, clubColor, siteName, uploadCloudName }: Props) {
  const [url, setUrl] = useState(initial.url);
  const [fit, setFit] = useState<CardBackgroundFit>(initial.fit);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [uploadKey, setUploadKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fitGroupId = useId();
  const opacityId = useId();

  const urlAccepted = url === "" || safeCardBackgroundUrl(url, uploadCloudName) !== null;
  const previewBackground = url && urlAccepted ? { url, fit, opacity } : null;

  const previewPlans: (MemberCardBackgroundPlan | null)[] = plans.length > 0 ? plans : [null];

  function changeUrl(next: string) {
    setUrl(next);
    setSaved(false);
    setError(null);
  }

  function removeImage() {
    // Remonta o ImageUpload para limpar o estado interno dele também.
    setUploadKey((k) => k + 1);
    changeUrl("");
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await updateMemberCardBackgroundAdmin({ url, fit, opacity });
        if (res.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } else {
          setError(res.error ?? "Não foi possível salvar.");
        }
      } catch {
        setError("Não foi possível salvar. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 max-w-xl">
          <div className="flex flex-col gap-2">
            <ImageUpload
              key={uploadKey}
              name="memberCardBackgroundUrl"
              defaultValue={url}
              label="Imagem de fundo do cartão"
              folder="misto"
              accept="image/png,image/jpeg,image/webp"
              onChange={changeUrl}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG ou WebP, até 10 MB. Recomendado: 1200 × 757 px ou maior, na proporção do cartão (1,59 : 1).
            </p>
            {url && (
              <button
                type="button"
                onClick={removeImage}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <X size={13} /> Remover imagem
              </button>
            )}
            {!urlAccepted && (
              <p className="text-xs text-destructive">
                Este endereço não é aceito. Envie a imagem pelo botão de envio.
              </p>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-muted-foreground mb-1">Ajuste da imagem</legend>
            {FIT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`${fitGroupId}-fit`}
                  value={opt.value}
                  checked={fit === opt.value}
                  onChange={() => {
                    setFit(opt.value);
                    setSaved(false);
                  }}
                  className="mt-1 accent-primary"
                />
                <span className="text-sm">
                  <span className="text-foreground font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor={opacityId} className="text-sm text-muted-foreground">
              Opacidade da imagem: <span className="text-foreground tabular-nums">{opacity}%</span>
            </label>
            <input
              id={opacityId}
              type="range"
              min={CARD_BACKGROUND_OPACITY_MIN}
              max={CARD_BACKGROUND_OPACITY_MAX}
              step={1}
              value={opacity}
              onChange={(e) => {
                setOpacity(Number(e.target.value));
                setSaved(false);
              }}
              aria-valuetext={`${opacity}%`}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Abaixo de 100%, a cor do plano aparece por trás da imagem.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending || !urlAccepted}
              className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar visual"
              )}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check size={14} /> Salvo!
              </span>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Prévia</p>
          <p className="text-xs text-muted-foreground">
            Dados fictícios. Cada plano aparece com a própria cor; sem cor própria, usa a cor do clube.
            A prévia mostra o que está acima, ainda não salvo.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {previewPlans.map((plan) => (
            <div key={plan?.id ?? "club"} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {plan ? (plan.cardColor ? plan.name : `${plan.name} (cor do clube)`) : "Cor do clube"}
              </p>
              <MemberCard card={previewCard(plan, clubColor, previewBackground)} siteName={siteName} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
