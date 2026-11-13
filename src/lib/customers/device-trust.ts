import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { getMyCustomerWhere } from "@/lib/accounts/my-customer";

/**
 * "Lembrar o aparelho" do comprador.
 *
 * O WhatsApp digitado numa tela pública não prova identidade. Para o cliente recorrente
 * continuar comprando sem redigitar nada (sem atrito), os dados guardados do cadastro
 * (nome, e-mail, CPF) só são reaproveitados quando:
 *   - a pessoa está logada na conta dona daquele WhatsApp; ou
 *   - este navegador já provou ser do dono daquele WhatsApp antes (cookie abaixo).
 *
 * O cookie é gravado quando uma compra/cadastro mostra que quem está no aparelho conhece
 * o cadastro: cliente novo (o cadastro é dele) ou e-mail digitado igual ao do cadastro.
 * Quem digita o WhatsApp de outra pessoa não tem o cookie e precisa digitar os dados.
 *
 * O cookie é httpOnly, assinado (JWT HS256), preso ao clube e não leva o telefone em
 * claro — só uma marca HMAC dele.
 */
export const DEVICE_COOKIE = "cli_disp";
const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // máximo aceito pelos navegadores
const MAX_PHONES = 5; // aparelho compartilhado (família) sem crescer sem limite
const PURPOSE = "device";

function getKey(): string | null {
  return process.env.CUSTOMER_AUTH_SECRET ?? process.env.TICKET_SIGNING_SECRET ?? null;
}

/** WhatsApp só com dígitos, no formato gravado em `customers.whatsapp`. */
export function phoneDigits(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13 ? d : null;
}

function phoneTag(key: string, tenant: string, digits: string): string {
  return createHmac("sha256", key).update(`${PURPOSE}:${tenant}:${digits}`).digest("base64url").slice(0, 22);
}

async function readTags(key: string, tenant: string): Promise<string[]> {
  const store = await cookies();
  const token = store.get(DEVICE_COOKIE)?.value;
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(key), { algorithms: ["HS256"] });
    if (payload.pur !== PURPOSE || (payload.tn ?? "") !== tenant) return [];
    const ph = payload.ph;
    return Array.isArray(ph) ? ph.filter((t): t is string => typeof t === "string").slice(0, MAX_PHONES) : [];
  } catch {
    return [];
  }
}

/** Este navegador já provou ser do dono deste WhatsApp? */
export async function isTrustedDeviceFor(whatsapp: unknown): Promise<boolean> {
  const digits = phoneDigits(whatsapp);
  const key = getKey();
  if (!digits || !key) return false;
  try {
    const tenant = (await getCurrentTenantSlug()) ?? "";
    return (await readTags(key, tenant)).includes(phoneTag(key, tenant, digits));
  } catch {
    return false;
  }
}

/**
 * Pode completar nome/e-mail/CPF a partir do cadastro deste WhatsApp?
 * Só para o dono: logado na conta dele, ou aparelho lembrado.
 */
export async function canReuseStoredIdentity(whatsapp: unknown): Promise<boolean> {
  const digits = phoneDigits(whatsapp);
  if (!digits) return false;
  try {
    const mine = await getMyCustomerWhere();
    if (mine && mine.phone === digits) {
      const db = await getDb();
      const [row] = await db.select({ id: customers.id }).from(customers).where(and(mine.where, eq(customers.whatsapp, digits))).limit(1);
      if (row) return true;
    }
  } catch {
    /* sem sessão/contas neste clube: segue para o aparelho */
  }
  return isTrustedDeviceFor(digits);
}

/**
 * Lembra o aparelho para este WhatsApp se quem comprou mostrou ser o dono do cadastro:
 * o e-mail usado é o do cadastro (cliente novo — o cadastro acabou de ser criado com ele —
 * ou recorrente que digitou o mesmo e-mail). Chamar DEPOIS do upsert do cliente.
 * Best-effort: nunca quebra a compra.
 */
export async function rememberDeviceIfOwner(whatsapp: unknown, email: unknown): Promise<void> {
  const digits = phoneDigits(whatsapp);
  const key = getKey();
  if (!digits || !key || typeof email !== "string" || !email.trim()) return;
  try {
    const db = await getDb();
    const [row] = await db.select({ email: customers.email }).from(customers).where(eq(customers.whatsapp, digits)).limit(1);
    if (!row || row.email.trim().toLowerCase() !== email.trim().toLowerCase()) return;

    const tenant = (await getCurrentTenantSlug()) ?? "";
    const tag = phoneTag(key, tenant, digits);
    const tags = [tag, ...(await readTags(key, tenant)).filter((t) => t !== tag)].slice(0, MAX_PHONES);
    const token = await new SignJWT({ pur: PURPOSE, tn: tenant, ph: tags })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${DEVICE_MAX_AGE_SECONDS}s`)
      .sign(new TextEncoder().encode(key));
    const store = await cookies();
    store.set(DEVICE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_MAX_AGE_SECONDS,
    });
  } catch {
    /* fora de um request (cron/teste) ou banco indisponível: só não lembra */
  }
}
