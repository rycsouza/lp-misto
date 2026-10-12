import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customerAccounts } from "@/lib/db/schema";
import { verifyAccountToken } from "@/lib/accounts/tokens";
import { getCurrentTenantSlug } from "@/lib/base-url";

/**
 * Link de confirmação de e-mail da conta. Só CONFIRMA o e-mail — não abre
 * sessão (evita "login CSRF": alguém mandar o próprio link para a vítima e ela
 * ficar logada na conta do atacante). Depois, a pessoa entra com a senha.
 * Idempotente: leitores de e-mail que pré-carregam o link não causam dano.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const dest = new URL("/conta", req.nextUrl);
  const claims = await verifyAccountToken("verify", token, await getCurrentTenantSlug());
  if (!claims) {
    dest.searchParams.set("confirmacao", "invalida");
    return NextResponse.redirect(dest);
  }
  try {
    const db = await getDb();
    const [acc] = await db
      .select({ id: customerAccounts.id, emailVerifiedAt: customerAccounts.emailVerifiedAt })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, claims.aid))
      .limit(1);
    if (!acc) {
      dest.searchParams.set("confirmacao", "invalida");
      return NextResponse.redirect(dest);
    }
    if (!acc.emailVerifiedAt) {
      await db.update(customerAccounts).set({ emailVerifiedAt: new Date() }).where(eq(customerAccounts.id, acc.id));
    }
    dest.searchParams.set("confirmacao", "ok");
    return NextResponse.redirect(dest);
  } catch (err) {
    console.error("[conta] falha ao confirmar e-mail:", err);
    dest.searchParams.set("confirmacao", "erro");
    return NextResponse.redirect(dest);
  }
}
