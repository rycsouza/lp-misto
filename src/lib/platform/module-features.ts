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
 * NÃO mapeados (as actions dessas telas não passam por requireModule):
 * - loja, rifas (requireLoja/requireRifas em admin-shop.ts / admin-raffles.ts);
 * - cortesia (courtesy-tickets.ts usa getAdminSession direto);
 * - retirada (rota usa o módulo "pedidos", que é de outra feature).
 * Ver pendências no relatório da tarefa.
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
]);

/** Feature que governa o módulo, ou null quando o módulo não tem kill-switch. */
export function featureForModule(moduleKey: string): string | null {
  return MODULE_FEATURE.get(moduleKey) ?? null;
}
