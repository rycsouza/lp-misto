/**
 * Seções da home: lista canônica, ordem, rótulo e ordenação. Módulo puro (sem I/O e sem
 * "use server"): usado pela leitura da configuração (getAllSectionMeta), pela home, pelos
 * menus, pela política de chaves do admin e pela aba Seções.
 *
 * Chaves de configuração por seção (tenant, gravadas pela aba Seções):
 * - section.<key>.enabled  "true" | "false" (ausente = ligada)
 * - section.<key>.order    posição inteira (ausente = derivada, ver SECTION_ORDER_ANCHOR)
 * - section.<key>.label    rótulo personalizado (vazio = padrão do componente)
 */
import { isValidLabelText } from "@/lib/label-rule";

/** Ordem canônica padrão da home (também a lista que o admin do clube ordena). */
export const HOME_SECTION_KEYS = [
  "hero",
  "ticket_highlight",
  "news",
  "squad",
  "board",
  "history",
  "member_wall",
  "membership",
  "sponsors",
  "shop",
  "raffle",
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

/** Tamanho do rótulo de seção (mesma regra de rótulos de src/lib/label-rule.ts). */
export const SECTION_LABEL_MIN_CHARS = 2;
export const SECTION_LABEL_MAX_CHARS = 40;

/**
 * Seção sem ordem salva fica logo ANTES da seção âncora (a ordem dela menos meio ponto). Assim
 * uma seção nova não cai no meio de um clube que já tem ordens gravadas.
 */
export const SECTION_ORDER_ANCHOR: Readonly<Record<string, string>> = {
  member_wall: "membership",
};

const SECTION_LABEL_KEY_RE = /^section\.[a-z_]+\.label$/;

/** Chave de configuração do rótulo de uma seção. */
export function sectionLabelKey(key: string): string {
  return `section.${key}.label`;
}

/**
 * Rótulo a exibir a partir de um valor cru (banco, payload). Devolve o texto trimado se for
 * válido; senão "" (= usa o padrão do componente). Nunca lança.
 */
export function resolveSectionLabel(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const label = raw.trim();
  return isValidLabelText(label, SECTION_LABEL_MIN_CHARS, SECTION_LABEL_MAX_CHARS) ? label : "";
}

/** true se o texto é um rótulo de seção válido (já trimado). Vazio NÃO é válido. */
export function isValidSectionLabelText(value: string): boolean {
  return isValidLabelText(value, SECTION_LABEL_MIN_CHARS, SECTION_LABEL_MAX_CHARS);
}

/**
 * Valor de uma chave de rótulo de seção gravada pelo admin: vazio (volta ao padrão) ou
 * rótulo válido. Outras chaves: sempre válidas aqui.
 */
export function isValidSectionLabelConfigValue(key: string, value: string): boolean {
  if (!SECTION_LABEL_KEY_RE.test(key)) return true;
  return value === "" || isValidSectionLabelText(value);
}

/**
 * Ordens gravadas (`section.<key>.order`) das seções pedidas, só as que são inteiros finitos.
 * `read` devolve o valor cru de uma chave (ou undefined se não há linha).
 */
export function savedSectionOrders(
  keys: readonly string[],
  read: (configKey: string) => string | undefined,
): Map<string, number> {
  const saved = new Map<string, number>();
  for (const key of keys) {
    const raw = read(`section.${key}.order`);
    // Number("") vale 0: vazio não é ordem gravada.
    if (raw === undefined || raw.trim() === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) saved.set(key, n);
  }
  return saved;
}

/**
 * Ordem efetiva de cada seção. `saved` traz só as ordens gravadas (inteiros finitos). Sem
 * ordem gravada, a seção usa a posição na lista de `keys` (1-based), exceto as que têm âncora
 * em SECTION_ORDER_ANCHOR: essas caem logo antes da âncora.
 */
export function resolveSectionOrders(
  keys: readonly string[],
  saved: ReadonlyMap<string, number>,
): Map<string, number> {
  const orders = new Map<string, number>();
  for (const key of keys) {
    const value = saved.get(key);
    if (value !== undefined) orders.set(key, value);
  }
  keys.forEach((key, index) => {
    if (orders.has(key)) return;
    const anchor = SECTION_ORDER_ANCHOR[key];
    const anchorIndex = anchor === undefined ? -1 : keys.indexOf(anchor);
    if (anchorIndex >= 0) {
      const anchorOrder = orders.get(anchor) ?? anchorIndex + 1;
      orders.set(key, anchorOrder - 0.5);
    } else {
      orders.set(key, index + 1);
    }
  });
  return orders;
}

/** Metadados de uma seção como saem de getAllSectionMeta. */
export interface SectionMetaEntry {
  enabled: boolean;
  order: number;
  /** Rótulo personalizado já validado; "" = padrão. */
  label: string;
}

/**
 * Texto de uma seção ou de um link de menu: o rótulo do clube quando houver, senão o padrão.
 * Usa só os dados de seção já carregados (sem consulta nova). Com `fallback` undefined,
 * devolve undefined quando não há rótulo.
 */
export function getSectionLabel<F extends string | undefined>(
  meta: Readonly<Record<string, Partial<Pick<SectionMetaEntry, "label">> | undefined>>,
  key: string,
  fallback: F,
): string | F {
  const custom = resolveSectionLabel(meta[key]?.label);
  return custom !== "" ? custom : fallback;
}

/**
 * Seções a exibir na home, na ordem da configuração. Tira as escondidas (kill-switch da
 * plataforma) e ordena pela ordem efetiva; a checagem de "ligada" fica na própria seção.
 */
export function orderHomeSections(
  keys: readonly string[],
  meta: Readonly<Record<string, Partial<Pick<SectionMetaEntry, "order">> | undefined>>,
  hidden: ReadonlySet<string>,
): string[] {
  return keys
    .filter((key) => !hidden.has(key))
    .sort((a, b) => (meta[a]?.order ?? 99) - (meta[b]?.order ?? 99));
}
