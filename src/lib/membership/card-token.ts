import { eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";

/**
 * Troca o token da carteirinha do sócio (segredo do QR/link de verificação). O token
 * antigo deixa de valer na hora: prints, links e o passe da Google Carteira com o QR
 * antigo passam a ser recusados. Sem "use server": é lógica interna, chamada pelas
 * actions de conta e de admin, que já fazem a autorização.
 *
 * Devolve true se o sócio existe (e recebeu o token novo), false se não existe.
 * O token novo NUNCA é devolvido: quem precisa dele lê de novo pelo fluxo normal.
 */

type Db = Awaited<ReturnType<typeof getDb>>;

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === UNIQUE_VIOLATION || /unique/i.test(String(err));
}

export async function rotateMemberCardToken(db: Db, memberId: string): Promise<boolean> {
  // Colisão no índice unique é praticamente impossível com UUID v4; mesmo assim tenta
  // mais uma vez com outro valor antes de desistir (o erro original segue o caminho).
  for (let attempt = 1; ; attempt++) {
    try {
      const rows = await db
        .update(members)
        .set({ memberCardToken: crypto.randomUUID() })
        .where(eq(members.id, memberId))
        .returning({ id: members.id });
      return rows.length > 0;
    } catch (err) {
      if (attempt >= 2 || !isUniqueViolation(err)) throw err;
    }
  }
}
