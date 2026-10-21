import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";

/**
 * Sócio do e-mail da conta logada (mesma regra do `findMyMember` da área logada: e-mail
 * sem diferença de maiúsculas). Uso INTERNO: devolve só o necessário para a foto. O e-mail
 * vem da sessão validada, nunca do cliente.
 */
export async function findMemberByAccountEmail(email: string): Promise<{
  id: string;
  name: string;
  photoUrl: string | null;
  photoPublicId: string | null;
} | null> {
  const db = await getDb();
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      photoUrl: members.photoUrl,
      photoPublicId: members.photoPublicId,
    })
    .from(members)
    .where(sql`lower(${members.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return m ?? null;
}
