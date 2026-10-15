/**
 * Mapeamento MÓDULO → FEATURE do kill-switch da plataforma.
 *
 * A chave passada a `requireModule(moduleKey)` (permissão do admin do clube) é a
 * mesma usada nas server actions. Quando o admin do SISTEMA desliga a feature
 * correspondente para o clube, `requireModule` passa a recusar a execução no
 * SERVIDOR (não só esconder a rota) — ver `assertModuleEnabledForClub`.
 *
 * Módulos fora deste mapa seguem sem kill-switch (comportamento anterior).
 * Chaves de feature devem existir em FEATURES (src/lib/platform/features.ts).
 *
 * Chaves "só de feature" (cortesia, retirada): NÃO são permissões de usuário. Elas
 * existem para o kill-switch quando a permissão real é outra; use
 * `requireModuleFor(permissão, chaveDeFeature)` (ex.: cortesia → permissão "jogos";
 * retirada → permissão "pedidos", igual ao menu do painel).
 *
 * Módulo puro (sem imports) de propósito: importável em testes e no cliente.
 */
export const MODULE_FEATURE: ReadonlyMap<string, string> = new Map([
  ["validacao", "validacao"],
  ["socios", "socios"],
  ["cupons", "cupons"], // também cobre promoções e afiliados (mesmo módulo)
  ["upsell", "upsell"],
  ["leads", "leads"],
  ["noticias", "noticias"],
  ["cantina_catalogo", "cantina"],
  ["cantina_preparo", "cantina"],
  ["cantina_entrega", "cantina"],
  ["loja", "loja"],
  ["rifas", "rifas"],
  ["cortesia", "cortesia"], // chave só de feature (permissão real: "jogos")
  ["retirada", "retirada"], // chave só de feature (permissão real: "pedidos")
]);

/** Feature que governa o módulo, ou null quando o módulo não tem kill-switch. */
export function featureForModule(moduleKey: string): string | null {
  return MODULE_FEATURE.get(moduleKey) ?? null;
}
