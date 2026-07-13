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
export async function signPhoneToken(whatsappDigits: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const tel = whatsappDigits.replace(/\D/g, "");
  if (tel.length < 10) return null;

  return new SignJWT({ tel, v: VERSION })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/** Verifica o token e devolve os dígitos do telefone, ou null se inválido/expirado. */
export async function verifyPhoneToken(token: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    const tel = String(payload.tel ?? "").replace(/\D/g, "");
    return tel.length >= 10 ? tel : null;
  } catch {
    return null;
  }
}
