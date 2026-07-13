import { headers } from "next/headers";

/**
 * URL base do tenant ATUAL, derivada do host da request (multi-tenant). Usar em
 * e-mails, convites e links de afiliado em vez de um domínio fixo. Fallback para
 * APP_URL (env) quando não há request scope (ex.: scripts). NUNCA retorna um
 * domínio hardcoded de clube — sem host e sem APP_URL, devolve "".
 */
export async function getAppBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* fora de um request scope (script/cron sem host) */
  }
  return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

/**
 * Slug do tenant atual (injetado pelo proxy como `x-tenant-slug`). Usado para
 * vincular tokens de acesso ao clube que os emitiu. Retorna null fora de um
 * request scope ou quando o host não resolve um tenant.
 */
export async function getCurrentTenantSlug(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-tenant-slug");
  } catch {
    return null;
  }
}
