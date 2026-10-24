import { and, eq, sql, type SQL } from "drizzle-orm";
import { customers } from "@/lib/db/schema";
import { getCustomerAccount } from "./session";
import { normalizeAccountPhone } from "./identity";

/**
 * Filtro do cadastro de compras (`customers`) do cliente LOGADO, ou null.
 *
 * O telefone digitado numa tela pública não prova identidade (qualquer um sabe o
 * WhatsApp de alguém). A posse vem da sessão (conta_sess) e exige o WhatsApp E o
 * e-mail verificado da conta batendo com o cadastro — o WhatsApp da conta sozinho
 * não basta (contas antigas podem cadastrá-lo uma vez, sem verificação).
 */
export async function getMyCustomerWhere(): Promise<{ phone: string; where: SQL } | null> {
  const me = await getCustomerAccount();
  const phone = me ? normalizeAccountPhone(me.whatsapp) : null;
  if (!me || !phone) return null;
  const where = and(
    eq(customers.whatsapp, phone),
    sql`lower(${customers.email}) = ${me.email.trim().toLowerCase()}`
  ) as SQL;
  return { phone, where };
}
