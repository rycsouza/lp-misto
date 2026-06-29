import { getAdminSession, type AdminSession } from "@/app/actions/admin-auth";

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

/** Exige `admin` OU a permissão de módulo informada (ex.: "jogos", "cupons", "socios"). */
export async function requireModule(moduleKey: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session || (session.role !== "admin" && !session.permissions[moduleKey])) {
    throw new Error("Não autorizado");
  }
  return session;
}
