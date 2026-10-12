import bcrypt from "bcryptjs";

const COST = 12;
// Hash fixo (de uma senha aleatória) para comparar quando a conta não existe:
// o tempo de resposta do login não revela se o e-mail tem conta.
const DUMMY_HASH = "$2b$12$WSTS6xj7//ENaJu375iOFeN8Swwh8RO2k3vMSFhEgv9bkznGxoFLS";

export const PASSWORD_MIN = 8;
/**
 * Conta recém-criada ainda SEM senha: a senha é definida pelo link enviado ao
 * e-mail (quem cria a senha é sempre o dono do e-mail). Nunca autentica.
 */
export const UNUSABLE_PASSWORD_HASH = "!";
// bcrypt só considera os primeiros 72 BYTES — acima disso, partes da senha seriam ignoradas.
const PASSWORD_MAX_BYTES = 72;

/** Regra de senha. Devolve a mensagem de erro, ou null se ok. */
export function passwordProblem(password: string, email?: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "A senha é longa demais (máximo de 72 caracteres).";
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return "A senha não pode ser igual ao e-mail.";
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

/** Compara em tempo ~constante mesmo sem conta/senha (usa o hash fictício). */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const usable = typeof hash === "string" && hash.startsWith("$2") ? hash : null;
  const ok = await bcrypt.compare(password ?? "", usable ?? DUMMY_HASH);
  return !!usable && ok;
}
