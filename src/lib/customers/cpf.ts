import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { validateCPF } from "@/lib/cpf";
import { canReuseStoredIdentity } from "./device-trust";

/**
 * CPF efetivo do comprador. O informado vence, desde que VÁLIDO (dígito
 * verificador); sem ele, reutiliza o CPF do cadastro (cliente recorrente) — só para
 * o dono daquele WhatsApp (logado ou aparelho lembrado — ver ./device-trust).
 * Resolvido SÓ no servidor — o valor salvo nunca vai para o client (LGPD).
 */
export async function resolveCustomerCpf(
  whatsappDigits: string,
  provided?: string | null,
): Promise<string | undefined> {
  if (provided && validateCPF(provided)) return provided.replace(/\D/g, "");
  if (!(await canReuseStoredIdentity(whatsappDigits))) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ cpf: customers.cpf })
    .from(customers)
    .where(eq(customers.whatsapp, whatsappDigits))
    .limit(1);
  return row?.cpf && validateCPF(row.cpf) ? row.cpf.replace(/\D/g, "") : undefined;
}
