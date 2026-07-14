/**
 * Colunas ordenáveis da listagem de clientes (whitelist compartilhada entre a
 * action e a página). Fica fora do arquivo "use server" porque módulos de
 * server action só podem exportar funções async — não constantes/objetos.
 */
export const CUSTOMER_SORT_KEYS = ["name", "whatsapp", "orders", "total", "last", "first"] as const;
export type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];
