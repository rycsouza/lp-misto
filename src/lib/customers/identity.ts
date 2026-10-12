import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";

type BuyerLike = { name?: unknown; email?: unknown; whatsapp?: unknown };

/**
 * Cliente recorrente: o lookup público por WhatsApp devolve só dados MASCARADOS
 * (LGPD — evita colher nome/e-mail varrendo telefones). Quando o client escolhe
 * "usar o cadastro" e não reenvia nome/e-mail, completa os campos faltantes a
 * partir do cadastro daquele WhatsApp — só no servidor. Valores enviados pelo
 * client vencem. Chamar ANTES da validação do comprador (o schema valida o
 * resultado final).
 */
export async function withStoredIdentity<T extends BuyerLike>(buyer: T): Promise<T> {
  if (!buyer || typeof buyer !== "object") return buyer;
  const name = typeof buyer.name === "string" ? buyer.name.trim() : "";
  const email = typeof buyer.email === "string" ? buyer.email.trim() : "";
  if (name && email) return buyer;

  const digits = typeof buyer.whatsapp === "string" ? buyer.whatsapp.replace(/\D/g, "") : "";
  if (digits.length < 10 || digits.length > 13) return buyer;

  const db = await getDb();
  const [row] = await db
    .select({ name: customers.name, email: customers.email })
    .from(customers)
    .where(eq(customers.whatsapp, digits))
    .limit(1);
  if (!row) return buyer;

  return { ...buyer, name: name || row.name, email: email || row.email };
}
