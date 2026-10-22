import { formatCNPJ } from "@/lib/cnpj";

/**
 * Bloco da empresa no detalhe do sócio (admin). Função PURA. Só existe para plano 'pj' (o público
 * vem do plano atual): sócio de CPF devolve null. O CNPJ sai formatado (aceita o alfanumérico).
 */
export interface AdminCompanyView {
  companyName: string | null;
  /** CNPJ formatado (00.000.000/0000-00); se o valor gravado não tiver 14 caracteres, sai como está. */
  cnpj: string | null;
}

export function adminCompanyView(input: {
  audience: string | null;
  cnpj: string | null;
  companyName: string | null;
}): AdminCompanyView | null {
  if (input.audience !== "pj") return null;
  const name = input.companyName?.trim() ?? "";
  return {
    companyName: name || null,
    cnpj: input.cnpj ? formatCNPJ(input.cnpj) : null,
  };
}
