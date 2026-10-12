import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { validateCPF } from "@/lib/cpf";

/**
 * Cria o cadastro do cliente (chave: WhatsApp) ou devolve o existente.
 *
 * SEGURANÇA (paliativo, sem atrito na compra): o WhatsApp NÃO é verificado, então
 * um cadastro EXISTENTE nunca tem nome/e-mail sobrescritos por aqui — senão
 * qualquer pessoa trocaria o e-mail de outra digitando o telefone dela, e a
 * próxima compra da vítima "usando o cadastro" iria para o e-mail do atacante.
 * CPF só é preenchido se o cadastro ainda não tiver um (nunca é trocado).
 * O pedido em si continua usando os dados digitados (orders.customerEmail).
 */
export async function upsertCustomer(
  name: string,
  email: string,
  whatsapp: string,
  cpf?: string | null,
): Promise<string> {
  const db = await getDb();
  const normalized = whatsapp.replace(/\D/g, "");
  // Só persiste CPF válido (dígito verificador) — nunca grava lixo no cadastro.
  const cpfNormalized = cpf && validateCPF(cpf) ? cpf.replace(/\D/g, "") : null;
  const [row] = await db
    .insert(customers)
    .values({ name, email, whatsapp: normalized, cpf: cpfNormalized })
    .onConflictDoUpdate({
      target: customers.whatsapp,
      set: {
        cpf: sql`coalesce(${customers.cpf}, excluded.cpf)`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: customers.id });
  return row.id;
}
