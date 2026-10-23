/**
 * Destaques do hero (chave `heroStats`): lista JSON de pares número + rótulo exibidos na
 * primeira seção da home (ex.: [{"value":"1993","label":"Fundação"}]).
 *
 * Módulo puro (sem I/O e sem "use server"): usado pela action de gravação
 * (updateConfigValues) e pelo formulário da aba Clube (limites dos inputs).
 *
 * O admin do clube grava esta chave, então o VALOR é validado no servidor: formato exato,
 * quantidade e tamanho de cada texto. O React escapa o texto na tela; a regra evita
 * payload gigante, objeto com campos extras e quebra de layout.
 */

export const HERO_STATS_KEY = "heroStats";
export const HERO_STATS_MAX_ITEMS = 6;
export const HERO_STAT_VALUE_MAX_CHARS = 30;
export const HERO_STAT_LABEL_MAX_CHARS = 40;

/** Texto de um campo: string sem espaço nas bordas, sem quebra de linha ou controle, até `max`. */
function isValidStatText(raw: unknown, max: number): raw is string {
  return (
    typeof raw === "string" &&
    raw.length <= max &&
    raw === raw.trim() &&
    !/[\u0000-\u001f\u007f]/.test(raw)
  );
}

/**
 * Valor válido para gravar: vazio, ou array JSON de até 6 objetos { value, label }, só com
 * essas duas chaves, strings sem espaço nas bordas e ao menos uma das duas preenchida.
 */
export function isValidHeroStatsValue(value: string): boolean {
  if (value === "") return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed.length > HERO_STATS_MAX_ITEMS) return false;
  return parsed.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    if (keys.length !== 2 || !keys.includes("value") || !keys.includes("label")) return false;
    const { value: v, label } = item as Record<string, unknown>;
    return (
      isValidStatText(v, HERO_STAT_VALUE_MAX_CHARS) &&
      isValidStatText(label, HERO_STAT_LABEL_MAX_CHARS) &&
      (v !== "" || label !== "")
    );
  });
}

/** Valor de UMA chave gravada por `updateConfigValues`: só `heroStats` tem regra aqui. */
export function isValidHeroStatsConfigValue(key: string, value: string): boolean {
  if (key !== HERO_STATS_KEY) return true;
  return isValidHeroStatsValue(value);
}
