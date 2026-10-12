import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const PURPOSE = "member-cancel";

/** Mesma chave dos ingressos/links de pedidos; o claim `pur` isola o uso. */
function getSecret(): Uint8Array | null {
  const key = process.env.TICKET_SIGNING_SECRET;
  return key ? new TextEncoder().encode(key) : null;
}

/**
 * Token do link "confirmar cancelamento" enviado ao e-mail do sócio. Expira em
 * 24h e só serve para cancelar (claim `pur`), no clube que o emitiu (`tn`).
 */
export async function signCancelToken(memberId: string, tenant?: string | null): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const claims: { mid: string; pur: string; tn?: string } = { mid: memberId, pur: PURPOSE };
  if (tenant?.trim()) claims.tn = tenant.trim();
  return new SignJWT(claims).setProtectedHeader({ alg: ALG }).setIssuedAt().setExpirationTime("24h").sign(secret);
}

/** Devolve o id do sócio, ou null se inválido/expirado/de outro uso ou clube. */
export async function verifyCancelToken(token: string, tenant?: string | null): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    if (payload.pur !== PURPOSE) return null;
    const tokenTenant = payload.tn ? String(payload.tn) : null;
    if (tenant?.trim() && tokenTenant !== tenant.trim()) return null;
    const mid = String(payload.mid ?? "");
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mid) ? mid : null;
  } catch {
    return null;
  }
}
