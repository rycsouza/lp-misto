/**
 * Regras puras da carteirinha de sócio (sem I/O, fáceis de testar). Usadas pela
 * página pública do QR, pelo validador do painel e pela action de conferência.
 *
 * Segurança: o token da carteirinha é um segredo do sócio (vai no QR). Quem NÃO é
 * da equipe não vê nenhum dado do sócio; quem é da equipe vê só o necessário.
 */
import type { MemberStatus } from "./status";

export const CARTEIRINHA_PATH = "/socios/carteirinha";

/** UUID do token da carteirinha (case-insensitive). */
export const CARD_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tamanho máximo aceito para o texto lido do QR (evita entrada gigante). */
const MAX_QR_TEXT_LENGTH = 2048;

const TZ = "America/Sao_Paulo";

/**
 * Extrai o token de um texto lido do QR (ou colado) da carteirinha.
 *
 * Aceita `http(s)://<qualquer host>/socios/carteirinha?token=<uuid>` — o QR pode
 * ter sido gerado com o domínio do clube. Qualquer outra coisa (outro path, token
 * que não é UUID, token duplicado, `javascript:`, texto livre) devolve null, e o
 * chamador segue o fluxo normal (ex.: ingresso).
 */
export function parseCarteirinhaQr(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > MAX_QR_TEXT_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.pathname !== CARTEIRINHA_PATH && url.pathname !== `${CARTEIRINHA_PATH}/`) return null;

  const tokens = url.searchParams.getAll("token");
  if (tokens.length !== 1) return null;
  const token = tokens[0];
  return CARD_TOKEN_RE.test(token) ? token : null;
}

/**
 * Quem pode conferir sócios: a mesma regra de acesso à rota /admin/validacao
 * (requireModule("validacao") / canAccessRoute): admin (do clube ou do sistema
 * operando o clube) OU permissão "validacao". Editor sem a permissão fica de fora.
 */
export function canUseValidation(
  session: { role: string; permissions?: Record<string, boolean> } | null | undefined
): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  return !!session.permissions?.validacao;
}

/** Benefícios valem até a data paga quando o sócio cancelou dentro do período. */
export function benefitsUntilIso(
  status: MemberStatus,
  hasBenefits: boolean,
  nextBillingDate: Date | null
): string | null {
  return status === "cancelled" && hasBenefits && nextBillingDate ? nextBillingDate.toISOString() : null;
}

export function fmtDateBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function fmtMonthYearBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: TZ });
}

export type CardTone = "ok" | "warn" | "bad";

/**
 * Situação para a equipe: `tone` define a cor (verde / âmbar / vermelho) e
 * `headline` é o texto em destaque.
 */
export function describeCardStatus(c: {
  status: MemberStatus;
  hasBenefits: boolean;
  benefitsUntil: string | null;
}): { tone: CardTone; headline: string } {
  if (c.status === "active" && c.hasBenefits) return { tone: "ok", headline: "SÓCIO ATIVO" };
  if (c.status === "cancelled" && c.hasBenefits && c.benefitsUntil) {
    return { tone: "warn", headline: `BENEFÍCIOS ATÉ ${fmtDateBr(c.benefitsUntil)}` };
  }
  if (c.status === "suspended") return { tone: "bad", headline: "SUSPENSO" };
  if (c.status === "pending") return { tone: "bad", headline: "PENDENTE" };
  if (c.status === "cancelled") return { tone: "bad", headline: "CANCELADO" };
  return { tone: "bad", headline: "SEM BENEFÍCIOS" };
}
