// Tamanhos da loja, agrupados por faixa (adulto × infantil).
// Um mesmo produto pode ter variantes das duas faixas — a UI agrupa por faixa.

export const ADULT_SIZES = ["PP", "P", "M", "G", "GG", "XGG", "Único"] as const;
export const CHILD_SIZES = ["02", "03", "04", "06", "08", "10", "12", "14", "16"] as const;

/**
 * Faixa infantil = qualquer tamanho numérico (02, 03, 14…). Tamanhos adultos
 * são sempre rótulos (PP…Único), então "é número" ⇒ infantil.
 */
export function isChildSize(size: string): boolean {
  const n = Number(size.replace(",", "."));
  return size.trim() !== "" && !Number.isNaN(n);
}
