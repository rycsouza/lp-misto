import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const VERSION = 1;

function getSecret(): Uint8Array | null {
  const key = process.env.TICKET_SIGNING_SECRET;
  if (!key) return null;
  return new TextEncoder().encode(key);
}

/**
 * Gera um token JWT assinado com HMAC-SHA256 para o ingresso.
 * Contém ticketId, gameId e typeCode no payload — impossível forjar sem a chave.
 * Se TICKET_SIGNING_SECRET não estiver configurado, retorna o UUID puro (fallback).
 */
export async function signTicketToken(
  ticketId: string,
  gameId: string,
  typeCode: string
): Promise<string> {
  const secret = getSecret();
  if (!secret) return ticketId; // fallback sem chave configurada

  return new SignJWT({ tid: ticketId, gid: gameId, tc: typeCode, v: VERSION })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .sign(secret);
}

export interface VerifiedTicket {
  tid: string; // ticket UUID
  gid: string; // game UUID
  tc: string;  // type code
}

/**
 * Verifica a assinatura do token e retorna o payload.
 * Retorna null se a assinatura for inválida, expirada, ou o formato for desconhecido.
 */
export async function verifyTicketToken(token: string): Promise<VerifiedTicket | null> {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    if (!payload.tid || !payload.gid) return null;
    return {
      tid: String(payload.tid),
      gid: String(payload.gid),
      tc: String(payload.tc ?? ""),
    };
  } catch {
    return null;
  }
}

/** JWTs HS256 sempre começam com eyJ — heurística rápida para detectar o formato. */
export function isSignedToken(s: string): boolean {
  return s.startsWith("eyJ");
}
