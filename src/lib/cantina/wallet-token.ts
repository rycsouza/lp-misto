import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const VERSION = 1;
const TYP = "cantina_wallet"; // namespaceia: um token de ingresso não vale como carteira

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSecret(): Uint8Array | null {
  const key = process.env.TICKET_SIGNING_SECRET;
  if (!key) return null;
  return new TextEncoder().encode(key);
}

/**
 * Token opaco assinado para o QR da carteira da Cantina. Contém o customerId no
 * payload — impossível forjar sem a chave, e não expõe a PK crua no QR.
 * Sem TICKET_SIGNING_SECRET (modo degradado, ex.: dev), cai para o UUID puro,
 * mesma postura de `signTicketToken`.
 */
export async function signWalletToken(customerId: string): Promise<string> {
  const secret = getSecret();
  if (!secret) return customerId; // fallback sem chave configurada
  return new SignJWT({ cid: customerId, typ: TYP, v: VERSION })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .sign(secret);
}

/**
 * Verifica o token e devolve o customerId, ou null se inválido.
 * Com chave configurada, SÓ aceita token assinado com o claim correto (não
 * aceita UUID cru — é justamente o que estamos deixando de expor). Sem chave,
 * aceita UUID cru como fallback degradado.
 */
export async function verifyWalletToken(token: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return UUID_RE.test(token) ? token : null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    if (payload.typ !== TYP || !payload.cid) return null;
    return String(payload.cid);
  } catch {
    return null;
  }
}
