/**
 * CSV seguro para exportação pelo admin (puro, sem I/O).
 *
 * Injeção de fórmula: uma célula de TEXTO que começa com = + - @ (ou tab/CR) é
 * interpretada como fórmula pelo Excel/Sheets. Essas células recebem um apóstrofo
 * na frente e são sempre entre aspas. Números não são prefixados (são os valores
 * calculados pelo servidor).
 */
export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Linhas → texto CSV (separador vírgula, quebra de linha LF). */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
