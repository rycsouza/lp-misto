// Validação de CNPJ (dígitos verificadores), numérico e ALFANUMÉRICO. Módulo PURO — sem
// dependências de Node, seguro para importar no servidor e em client components.
//
// CNPJ alfanumérico (Receita Federal, emitido a partir de jul/2026): os 12 primeiros caracteres
// podem ser letras (A–Z) ou números; os 2 últimos seguem numéricos (dígitos verificadores).
// No cálculo, cada caractere vale (código ASCII − 48): '0'–'9' → 0–9, 'A' → 17 … 'Z' → 42.
// Mesmos pesos e módulo 11 do CNPJ numérico — o numérico antigo continua válido.

/** Só letras/números, em maiúsculas (remove máscara e espaços). */
export function normalizeCNPJ(cnpj: string): string {
  return cnpj.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function formatCNPJ(cnpj: string): string {
  const d = normalizeCNPJ(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara enquanto digita: 00.000.000/0000-00 (até 14 caracteres; letras só nas 12 primeiras). */
export function formatCNPJInput(value: string): string {
  const raw = normalizeCNPJ(value);
  // As 2 posições finais (verificadores) só aceitam número.
  let d = "";
  for (const ch of raw) {
    if (d.length >= 14) break;
    if (d.length >= 12 && !/\d/.test(ch)) continue;
    d += ch;
  }
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valor do caractere no cálculo: código ASCII − 48. */
function charValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

/** Dígito verificador: soma ponderada mod 11; resto < 2 vira 0. */
function checkDigit(chars: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += charValue(chars[i]) * weights[i];
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * true se o CNPJ tem 12 caracteres alfanuméricos + 2 dígitos, não é sequência repetida e os
 * dois verificadores conferem. Aceita com ou sem máscara, letras em minúscula ou maiúscula.
 */
export function validateCNPJ(cnpj: string): boolean {
  const d = normalizeCNPJ(cnpj);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d)) return false;
  if (/^(.)\1{13}$/.test(d)) return false; // todos iguais (ex.: 00.000.000/0000-00)
  return checkDigit(d, WEIGHTS_FIRST) === Number(d[12]) && checkDigit(d, WEIGHTS_SECOND) === Number(d[13]);
}
