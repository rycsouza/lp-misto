import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, membershipPlans } from "@/lib/db/schema";

/**
 * Sócio do e-mail da conta logada (mesma regra do `findMyMember` da área logada: e-mail
 * sem diferença de maiúsculas). Uso INTERNO: devolve só o necessário para foto e logo. O e-mail
 * vem da sessão validada, nunca do cliente. `planAudience` é o público do plano ATUAL (fonte
 * da verdade para liberar o logo: só 'pj').
 */
export async function findMemberByAccountEmail(email: string): Promise<{
  id: string;
  name: string;
  photoUrl: string | null;
  photoPublicId: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  planAudience: "pf" | "pj" | null;
} | null> {
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      photoUrl: members.photoUrl,
      photoPublicId: members.photoPublicId,
      logoUrl: members.logoUrl,
      logoPublicId: members.logoPublicId,
      planAudience: membershipPlans.audience,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(members.planId, membershipPlans.id))
    .where(sql`lower(${members.email}) = ${email.toLowerCase()}`)
    .limit(1);
  if (!m) return null;
  return {
    ...m,
    planAudience: m.planAudience === "pj" ? "pj" : m.planAudience === "pf" ? "pf" : null,
  };
}
