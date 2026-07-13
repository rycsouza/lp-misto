import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const VERSION = 1;

/** Reusa a chave de assinatura dos ingressos (mesmo domínio de confiança). */
function getSecret(): Uint8Array | null {
  const key = process.env.TICKET_SIGNING_SECRET;
  if (!key) return null;
  return new TextEncoder().encode(key);
}

/**
 * Token assinado que encapsula o telefone do comprador para o link de "Meus
 * Pedidos" enviado por WhatsApp. Evita PII crua na URL: o número nunca aparece
 * na query string — só o JWT, verificado no servidor. Expira em 30 dias.
 *
 * Sem TICKET_SIGNING_SECRET configurado, retorna null (o link cai para
 * /pedidos sem pré-carga; o torcedor digita o número manualmente).
 */
export async function signPhoneToken(
  whatsappDigits: string,
  tenant?: string | null
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const tel = whatsappDigits.replace(/\D/g, "");
  if (tel.length < 10) return null;

  const claims: { tel: string; v: number; tn?: string } = { tel, v: VERSION };
  if (tenant?.trim()) claims.tn = tenant.trim();

  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/**
 * Verifica o token e devolve os dígitos do telefone, ou null se inválido/expirado.
 * Se o token traz um claim de tenant (`tn`) e um `tenant` é informado, exige que
 * batam — assim um token de um clube não abre pedidos em outro. Tokens legados
 * (sem `tn`) seguem válidos até expirar.
 */
export async function verifyPhoneToken(
  token: string,
  tenant?: string | null
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    const tokenTenant = payload.tn ? String(payload.tn) : null;
    if (tokenTenant && tenant?.trim() && tokenTenant !== tenant.trim()) return null;
    const tel = String(payload.tel ?? "").replace(/\D/g, "");
    return tel.length >= 10 ? tel : null;
  } catch {
    return null;
  }
}
