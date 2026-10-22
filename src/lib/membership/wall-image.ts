import { isRenderableMemberLogoSrc } from "@/lib/membership/member-logo";
import { isRenderableMemberPhotoSrc } from "@/lib/membership/member-photo";

/**
 * Imagem do círculo do sócio no Mural (função PURA, segura no client). Ordem: logo da empresa
 * (só vem preenchido para plano 'pj', no servidor) → foto → iniciais. Cada `src` passa de novo
 * pelo validador da tela: só URL de entrega do projeto chega a <img src>.
 */
export type WallSocioImage = { kind: "logo"; src: string } | { kind: "photo"; src: string } | { kind: "initials" };

export function wallSocioImage(card: { logoUrl?: unknown; photoUrl?: unknown }): WallSocioImage {
  if (isRenderableMemberLogoSrc(card.logoUrl)) return { kind: "logo", src: card.logoUrl };
  if (isRenderableMemberPhotoSrc(card.photoUrl)) return { kind: "photo", src: card.photoUrl };
  return { kind: "initials" };
}
