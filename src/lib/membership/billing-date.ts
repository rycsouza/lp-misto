/**
 * Datas de cobrança do sócio no calendário de Brasília. Funções puras (sem banco nem gateway).
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Soma um mês a "AAAA-MM-DD" no calendário (a data já é de Brasília).
 * Dia que não existe no mês seguinte → último dia desse mês
 * (31/01 → 28/02, ou 29/02 em ano bissexto).
 */
export function addOneMonthBrasilia(dateOnly: string): string {
  const m = DATE_ONLY_RE.exec(dateOnly);
  if (!m) throw new Error(`Data inválida: ${dateOnly}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12 (mês de origem)
  const day = Number(m[3]);
  // Date.UTC normaliza mês 13 → janeiro do ano seguinte.
  const lastDayOfNext = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(year, month, Math.min(day, lastDayOfNext)));
  return target.toISOString().slice(0, 10);
}
