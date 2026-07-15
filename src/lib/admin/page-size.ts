import { cookies } from "next/headers";
import { ADMIN_PAGE_SIZE } from "./pagination";

/** Itens por página no mobile (menos rolagem em tela pequena). */
export const ADMIN_PAGE_SIZE_MOBILE = 5;
/** Cookie de viewport, setado no client por AdminViewportSync. */
export const ADMIN_VP_COOKIE = "adm_vp";

/**
 * Tamanho de página conforme o dispositivo: 5 no mobile, 10 no desktop.
 * O viewport chega via cookie (o servidor não conhece a largura da tela no SSR);
 * na ausência do cookie, assume desktop (10) — valor seguro para a maioria do
 * uso do painel. Só é server-side (usa cookies()); não importar em client.
 */
export async function getAdminPageSize(): Promise<number> {
  const store = await cookies();
  return store.get(ADMIN_VP_COOKIE)?.value === "m" ? ADMIN_PAGE_SIZE_MOBILE : ADMIN_PAGE_SIZE;
}
