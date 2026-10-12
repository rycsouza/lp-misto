import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

export type AccountTokenPurpose = "session" | "verify" | "reset";

const TTL: Record<AccountTokenPurpose, string> = {
  session: "30d",
  verify: "48h",
  reset: "1h",
};

/**
 * Chave da área do cliente. Preferir CUSTOMER_AUTH_SECRET dedicado; cai para a
 * chave dos ingressos (mesmo padrão dos links de pedidos). O claim `pur` isola
 * os usos: um token de sessão não serve para redefinir senha, etc.
 */
function getSecret(): Uint8Array | null {
  const key = process.env.CUSTOMER_AUTH_SECRET ?? process.env.TICKET_SIGNING_SECRET;
  return key ? new TextEncoder().encode(key) : null;
}

export interface AccountTokenClaims {
  aid: string;
  /** Versão da senha (ms de passwordChangedAt): trocar a senha invalida o token. */
  pwv: number;
}

export async function signAccountToken(
  purpose: AccountTokenPurpose,
  claims: AccountTokenClaims,
  tenant: string | null
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  return new SignJWT({ ...claims, pur: purpose, tn: tenant ?? "" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL[purpose])
    .sign(secret);
}

/** Verifica uso, clube e assinatura. NÃO confere pwv — quem chama compara com o banco. */
export async function verifyAccountToken(
  purpose: AccountTokenPurpose,
  token: string,
  tenant: string | null
): Promise<AccountTokenClaims | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    if (payload.pur !== purpose) return null;
    if ((payload.tn ?? "") !== (tenant ?? "")) return null;
    const aid = String(payload.aid ?? "");
    const pwv = Number(payload.pwv);
    if (!/^[0-9a-f-]{36}$/i.test(aid) || !Number.isFinite(pwv)) return null;
    return { aid, pwv };
  } catch {
    return null;
  }
}
