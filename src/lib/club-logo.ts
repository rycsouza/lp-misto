/**
 * Escudo / logo do clube (chave `clubLogoUrl` da siteConfig). Módulo puro: sem env, sem I/O.
 *
 * O admin do CLUBE grava o escudo pela aba Clube. O valor aparece em <img src>, em
 * metadados (OpenGraph, ícones do app), em e-mails e no CSS da impressão A4, então só
 * passa o que o próprio upload gera: https do destino de upload do projeto
 * (res.cloudinary.com/<cloud>/image/upload/...), caminho relativo do site ou vazio.
 * A regra de URL é a mesma do fundo da carteirinha (safeCardBackgroundUrl).
 */
import { isRenderableBackgroundSrc, safeCardBackgroundUrl } from "@/lib/membership/card-background";

export const CLUB_LOGO_KEY = "clubLogoUrl";

/** Valor que o admin do clube pode gravar: vazio (sem escudo) ou URL segura do projeto. */
export function isValidClubLogoConfigValue(value: string, cloudName: string | null | undefined): boolean {
  return value === "" || safeCardBackgroundUrl(value, cloudName) !== null;
}

/**
 * Escudo pronto para ir numa string montada à mão (CSS `url("...")`): sem aspas, <, >,
 * crase, barra invertida nem espaço. Fora disso devolve "" (sem escudo).
 */
export function safeClubLogoSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  return url && isRenderableBackgroundSrc(url) ? url : "";
}
