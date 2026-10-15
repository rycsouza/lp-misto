import { getAdminSession, type AdminSession } from "@/app/actions/admin-auth";
import { assertModuleEnabledForClub } from "@/lib/platform/module-gate";

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

/**
 * Exige `admin` OU a permissão de módulo informada (ex.: "jogos", "cupons", "socios").
 *
 * Depois da permissão, aplica o KILL-SWITCH da plataforma: se a feature que governa
 * o módulo (ver src/lib/platform/module-features.ts) estiver desligada para o clube,
 * lança "Módulo desativado para este clube." — inclusive para admin e admin do
 * sistema. Módulos sem feature mapeada não são afetados.
 */
export async function requireModule(moduleKey: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && !session.permissions[moduleKey])) {
    throw new Error("Não autorizado");
  }
  await assertModuleEnabledForClub(moduleKey);
  return session;
}
