import { navGroups } from "@/lib/admin/nav";

// Tudo aqui é DERIVADO de nav.ts — não editar manualmente.
// Para adicionar/remover um módulo na tela de permissões, basta mexer em
// src/lib/admin/nav.ts: a sidebar e as permissões ficam sempre em sincronia.

export interface ModuleEntry {
  /** chave de permissão persistida (permissions[key] = boolean) */
  key: string;
  /** rótulo curto (primeira tela que usa essa chave) */
  label: string;
  /** todas as telas que essa permissão libera (uma chave pode cobrir várias) */
  pages: string[];
}

export interface ModuleGroup {
  title: string;
  modules: ModuleEntry[];
}

/**
 * Módulos agrupados exatamente como a sidebar (nav.ts).
 * Itens adminOnly (e grupos adminOnly) são ignorados: não são permissões de editor.
 * Várias telas podem compartilhar a mesma `moduleKey` (ex.: Pedidos/Clientes/Retirada
 * → "pedidos"); todas aparecem em `pages` para deixar claro o que a permissão cobre.
 */
export const MODULE_GROUPS: ModuleGroup[] = navGroups
  .filter((g) => !g.adminOnly)
  .map((g) => {
    const byKey = new Map<string, string[]>();
    for (const item of g.items) {
      if (!item.moduleKey || item.adminOnly) continue;
      const pages = byKey.get(item.moduleKey) ?? [];
      pages.push(item.label);
      byKey.set(item.moduleKey, pages);
    }
    return {
      title: g.title,
      modules: Array.from(byKey, ([key, pages]) => ({
        key,
        label: pages[0],
        pages,
      })),
    };
  })
  .filter((g) => g.modules.length > 0);

/** Lista achatada de todos os módulos (sem duplicar chaves). */
export const ALL_MODULES: { key: string; label: string }[] = MODULE_GROUPS.flatMap(
  (g) => g.modules.map((m) => ({ key: m.key, label: m.label }))
);

/** Todas as chaves de permissão válidas — útil para validação no backend. */
export const ALL_MODULE_KEYS: string[] = ALL_MODULES.map((m) => m.key);
