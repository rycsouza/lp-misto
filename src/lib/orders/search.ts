import { or, ilike, sql } from "drizzle-orm";
import { orders } from "@/lib/db/schema";

/**
 * Condição de busca de pedidos por nome, e-mail ou WhatsApp. O telefone é
 * gravado FORMATADO (ex.: "(67) 99211-9358"), então além do ILIKE normal também
 * comparamos SÓ OS DÍGITOS (normalizando a coluna com regexp_replace) — assim
 * buscar "992119358" ou "67 99211-9358" encontra o pedido. Antes, digitar o
 * número puro nunca casava por causa dos "( ) - espaço". Retorna undefined se o
 * termo for vazio.
 */
export function orderSearchCondition(rawTerm: string) {
  const term = rawTerm.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  const clauses = [
    ilike(orders.customerName, pattern),
    ilike(orders.customerEmail, pattern),
    ilike(orders.customerWhatsapp, pattern),
  ];
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 3) {
    clauses.push(
      sql`regexp_replace(${orders.customerWhatsapp}, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`
    );
  }
  return or(...clauses);
}
