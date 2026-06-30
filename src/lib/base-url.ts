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
