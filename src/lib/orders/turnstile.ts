/**
 * Cloudflare Turnstile — captcha invisível para a consulta de "Meus Pedidos".
 *
 * Substitui a fricção do OTP no caminho de digitação manual do telefone: o
 * objetivo é bloquear EXPLORAÇÃO AUTOMATIZADA do endpoint (varredura de números),
 * não provar posse do telefone. Como o ingresso é nominal, o modelo de ameaça
 * aceito é "humano num navegador real", que é exatamente o que o Turnstile prova.
 *
 * Fail-safe: sem `TURNSTILE_SECRET_KEY` configurado, `isTurnstileConfigured()`
 * devolve false e o fluxo cai para o OTP — nunca deixa o cliente sem acesso.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Há chave secreta E chave pública (site key) configuradas? */
export function isTurnstileConfigured(): boolean {
  return (
    !!process.env.TURNSTILE_SECRET_KEY &&
    !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/**
 * Valida o token do widget contra o Cloudflare (server-to-server). O IP do
 * cliente é opcional e ajuda o Cloudflare a pontuar a requisição. Qualquer
 * falha (rede, token ausente, resposta inválida) resolve para `false` —
 * fail-closed. CSP não afeta esta chamada: é fetch de servidor, não do browser.
 */
export async function verifyTurnstileToken(
  token: string,
  ip?: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verify error:", err);
    return false;
  }
}
