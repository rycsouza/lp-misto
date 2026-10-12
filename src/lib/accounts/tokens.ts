import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

export type AccountTokenPurpose = "session" | "verify" | "reset";

/**
 * Sessão "sem fim": 400 dias é o máximo que os navegadores aceitam num cookie, e
 * o proxy renova o token a cada visita (renewSessionToken) — quem usa o site
 * nunca é deslogado. Revogação continua valendo: trocar a senha muda o `pwv`.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
/** Renova no máximo 1x por dia (evita reescrever o cookie a cada request). */
const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

const TTL: Record<AccountTokenPurpose, string> = {
  session: `${SESSION_MAX_AGE_SECONDS}s`,
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

/**
 * Renovação deslizante da sessão (chamada pelo proxy). Token de SESSÃO válido e
 * emitido há mais de 1 dia → novo token com os MESMOS claims (conta, versão de
 * senha e clube) e validade cheia. Não consulta o banco: a checagem de conta e de
 * `pwv` continua acontecendo a cada uso (getCustomerAccount), então renovar um
 * token de senha antiga não devolve acesso a ninguém. Caso contrário → null.
 */
export async function renewSessionToken(token: string, nowMs = Date.now()): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    if (payload.pur !== "session" || typeof payload.iat !== "number") return null;
    if (nowMs / 1000 - payload.iat < SESSION_RENEW_AFTER_SECONDS) return null;
    const aid = String(payload.aid ?? "");
    const pwv = Number(payload.pwv);
    if (!/^[0-9a-f-]{36}$/i.test(aid) || !Number.isFinite(pwv)) return null;
    const tenant = typeof payload.tn === "string" ? payload.tn : "";
    return signAccountToken("session", { aid, pwv }, tenant || null);
  } catch {
    return null;
  }
}
