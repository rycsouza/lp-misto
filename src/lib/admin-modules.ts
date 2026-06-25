import { navGroups } from "@/lib/admin/nav";

// Derivado de nav.ts — não editar manualmente.
// Para adicionar um módulo, basta adicionar o item em src/lib/admin/nav.ts.
export const ALL_MODULES = Array.from(
  new Map(
    navGroups
      .flatMap((g) => g.items)
      .filter((i) => i.moduleKey && !i.adminOnly)
      .map((i) => [i.moduleKey!, { key: i.moduleKey!, label: i.label }])
  ).values()
);
