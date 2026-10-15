import { getAdminSession, type AdminSession } from "@/app/actions/admin-auth";
import { isModuleDisabledForClub, MODULE_DISABLED_MESSAGE } from "@/lib/platform/module-gate";

/**
 * Guardas de autorização para Server Actions administrativas.
 *
 * IMPORTANTE: Server Actions são endpoints POST públicos — o gate de navegação
 * (proxy + layout) NÃO protege a execução. Toda action que muta dados admin (ou
 * lê dados sensíveis) deve chamar uma destas guardas no TOPO. Elas LANÇAM em caso
 * de não-autorização (admin legítimo nunca cai aqui).
 */

/** Exige sessão com papel `admin` (módulos adminOnly: gateways, IA, auditoria, usuários, tenants, campanhas). */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    throw new Error("Não autorizado");
  }
  return session;
}

/**
 * Exige admin do SISTEMA (sessão de plataforma operando um clube). Admin de
 * tenant é barrado: usado em módulos que o clube não deve gerir sozinho, como
 * gateways de pagamento (trocar a chave desviaria os recebimentos).
 */
export async function requirePlatformAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin" || session.isPlatform !== true) {
    throw new Error("Não autorizado");
  }
  return session;
}

/** Resultado de `checkModuleAccess`: a sessão liberada, ou o motivo da recusa (mensagem já pronta). */
export type ModuleAccess = { session: AdminSession } | { error: string };

/**
 * Permissão + KILL-SWITCH do módulo, sem lançar (para actions que devolvem
 * `{ success: false, error }` em vez de lançar).
 *
 * Ordem fixa: 1) sessão com `admin` OU a permissão `permissionKey` — sem isso
 * responde "Não autorizado" e a feature NÃO é consultada; 2) a feature que governa
 * `moduleKey` (ver src/lib/platform/module-features.ts) desligada para o clube →
 * "Módulo desativado para este clube.", inclusive para admin e admin do sistema.
 *
 * `moduleKey` default = `permissionKey`. Use outra chave quando a permissão do
 * menu não for a própria feature (ex.: cortesia → permissão "jogos", feature "cortesia").
 */
export async function checkModuleAccess(
  permissionKey: string,
  moduleKey: string = permissionKey
): Promise<ModuleAccess> {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && !session.permissions[permissionKey])) {
    return { error: "Não autorizado" };
  }
  if (await isModuleDisabledForClub(moduleKey)) {
    return { error: MODULE_DISABLED_MESSAGE };
  }
  return { session };
}

/**
 * Lança quando a permissão falta ("Não autorizado") ou a feature está desligada
 * ("Módulo desativado para este clube."). Ver `checkModuleAccess` para a ordem.
 */
export async function requireModuleFor(
  permissionKey: string,
  moduleKey: string = permissionKey
): Promise<AdminSession> {
  const access = await checkModuleAccess(permissionKey, moduleKey);
  if ("error" in access) throw new Error(access.error);
  return access.session;
}

/**
 * Exige `admin` OU a permissão de módulo informada (ex.: "jogos", "cupons", "socios")
 * e aplica o kill-switch da feature do próprio módulo. Ver `requireModuleFor`.
 */
export async function requireModule(moduleKey: string): Promise<AdminSession> {
  return requireModuleFor(moduleKey);
}
