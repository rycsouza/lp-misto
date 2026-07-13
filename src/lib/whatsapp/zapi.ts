/**
 * Cliente mínimo da Z-API (provedor não-oficial de WhatsApp) — envio de texto.
 *
 * Credenciais da PLATAFORMA (Sport55) via env, compartilhadas por todos os
 * tenants nesta fase: ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN
 * (o Client-Token é a trava de segurança da conta na Z-API). Sem as env vars,
 * o envio é um no-op — nunca lança para o chamador.
 */

export interface ZapiSendResult {
  ok: boolean;
  error?: string;
}

/**
 * Normaliza um telefone BR para o formato da Z-API (dígitos com DDI 55).
 * Retorna null se não parecer um número válido.
 */
export function toBrazilPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return null;
}

export function isZapiConfigured(): boolean {
  return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
}

export async function sendWhatsappText(
  phoneDigits: string,
  message: string
): Promise<ZapiSendResult> {
  const instance = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instance || !token) {
    console.warn("[whatsapp] ZAPI_* não configurado — envio ignorado");
    return { ok: false, error: "not_configured" };
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({ phone: phoneDigits, message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `http_${res.status}:${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
