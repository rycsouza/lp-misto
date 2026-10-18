import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { siteConfig } from "@/lib/db/schema";

/**
 * Código de convite do cadastro de atletas. INTERNO (não é server action): se
 * fosse exportado de um arquivo "use server", qualquer um leria o código pela
 * API e o convite deixaria de proteger o formulário.
 */
export async function readAthleteInviteCode(): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select({ value: siteConfig.value })
    .from(siteConfig)
    .where(eq(siteConfig.key, "athlete_invite_code"))
    .limit(1);
  return row?.value ?? "";
}

/** Comparação do código digitado (sem distinguir maiúsculas). Sem código configurado → livre. */
export function inviteCodeMatches(stored: string, typed: string): boolean {
  if (!stored) return true;
  return typed.trim().toLowerCase() === stored.trim().toLowerCase();
}
