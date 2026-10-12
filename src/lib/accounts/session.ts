import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerAccounts } from "@/lib/db/schema";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { signAccountToken, verifyAccountToken } from "./tokens";
import { ACCOUNT_COOKIE, ACCOUNT_COOKIE_OPTIONS } from "./cookie";

export { ACCOUNT_COOKIE };


export interface CustomerAccount {
  id: string;
  email: string;
  name: string;
  whatsapp: string | null;
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date;
}

/** Abre a sessão (cookie httpOnly) para a conta. */
export async function startAccountSession(account: { id: string; passwordChangedAt: Date }): Promise<boolean> {
  const token = await signAccountToken(
    "session",
    { aid: account.id, pwv: account.passwordChangedAt.getTime() },
    await getCurrentTenantSlug()
  );
  if (!token) return false;
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, token, ACCOUNT_COOKIE_OPTIONS);
  return true;
}

export async function endAccountSession(): Promise<void> {
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Conta logada, ou null. Exige token válido deste clube, conta existente, e-mail
 * confirmado e a MESMA versão de senha (trocar a senha derruba sessões antigas).
 */
export async function getCustomerAccount(): Promise<CustomerAccount | null> {
  const store = await cookies();
  const token = store.get(ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccountToken("session", token, await getCurrentTenantSlug());
  if (!claims) return null;
  try {
    const db = await getDb();
    const [acc] = await db
      .select({
        id: customerAccounts.id,
        email: customerAccounts.email,
        name: customerAccounts.name,
        whatsapp: customerAccounts.whatsapp,
        emailVerifiedAt: customerAccounts.emailVerifiedAt,
        passwordChangedAt: customerAccounts.passwordChangedAt,
      })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, claims.aid))
      .limit(1);
    if (!acc || !acc.emailVerifiedAt) return null;
    if (acc.passwordChangedAt.getTime() !== claims.pwv) return null;
    return acc;
  } catch (err) {
    // Ex.: migração 0030 ainda não aplicada neste clube.
    console.error("[conta] falha ao carregar sessão:", err);
    return null;
  }
}
