/** Tamanho de página padrão de TODAS as listagens do admin. */
export const ADMIN_PAGE_SIZE = 10;

/**
 * Monta a sequência de páginas para a paginação numerada, com reticências nos
 * intervalos (ex.: 1 … 4 5 6 … 20). Sempre mostra a primeira, a última e a
 * vizinhança da página atual.
 */
export function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 1) return [1];
  const wanted = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
