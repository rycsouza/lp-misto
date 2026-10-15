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

/** Prefixo do código curto da carteirinha (digitável no validador). */
export const MEMBER_CODE_PREFIX = "S-";

/** Tamanho máximo aceito para o código digitado (antes de normalizar). */
const MAX_CODE_INPUT_LENGTH = 32;

const SHORT_CODE_BODY_RE = /^s([0-9a-f]{8})$/;

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

/**
 * Código curto da carteirinha: "S-" + os 8 primeiros caracteres do token, em maiúsculas
 * (ex.: token "1a2b3c4d-…" → "S-1A2B3C4D"). Muda junto com o token: ao gerar uma
 * carteirinha nova, o código antigo deixa de valer. Não é o token inteiro (faltam 96 bits
 * do segredo), e só serve para a conferência pelo validador, que devolve dados mínimos.
 * Token inválido → null.
 */
export function memberShortCode(token: unknown): string | null {
  if (typeof token !== "string" || !CARD_TOKEN_RE.test(token)) return null;
  return `${MEMBER_CODE_PREFIX}${token.slice(0, 8).toUpperCase()}`;
}

/**
 * Lê o código curto digitado ou colado e devolve os 8 hex minúsculos, ou null.
 * Aceita "S-1A2B3C4D", "s1a2b3c4d", com espaços ou hífens em qualquer ponto. Qualquer
 * outro caractere (ex.: "%", "_", aspas), tamanho diferente de 8 ou letra fora de hex
 * devolve null.
 */
export function parseMemberShortCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > MAX_CODE_INPUT_LENGTH) return null;
  const compact = raw.replace(/[\s-]/g, "").toLowerCase();
  const match = SHORT_CODE_BODY_RE.exec(compact);
  return match ? match[1] : null;
}

/**
 * Classifica o que foi lido pela câmera ou digitado no validador da portaria:
 * - member_url: URL da carteirinha (QR) → token;
 * - member_code: código curto válido "S-…" → 8 hex;
 * - member_code_invalid: começa com "S" mas não é código válido (sem consulta);
 * - ticket_number: só dígitos → serial/código numérico do ingresso;
 * - other: qualquer outro texto (ex.: QR de ingresso, que é JWT "eyJ…" ou UUID).
 *
 * Nenhum formato de ingresso começa com "s" (JWT começa com "eyJ"; UUID, prefixo hex e
 * serial são hex ou dígitos), então "S…" inválido nunca desvia um ingresso.
 */
export type ValidatorInput =
  | { kind: "empty" }
  | { kind: "member_url"; token: string }
  | { kind: "member_code"; code: string }
  | { kind: "member_code_invalid" }
  | { kind: "ticket_number"; number: string }
  | { kind: "other" };

export function classifyValidatorInput(raw: string): ValidatorInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };

  const token = parseCarteirinhaQr(text);
  if (token) return { kind: "member_url", token };

  const code = parseMemberShortCode(text);
  if (code) return { kind: "member_code", code };

  if (/^s/i.test(text)) return { kind: "member_code_invalid" };
  // Nº do ingresso digitado com separadores ("12-34", "12 34", "12.34") vira só
  // dígitos — como o campo fazia antes de aceitar texto.
  if (/^[\d\s.-]+$/.test(text) && /\d/.test(text)) {
    return { kind: "ticket_number", number: text.replace(/\D/g, "") };
  }
  return { kind: "other" };
}
