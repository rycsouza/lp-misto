import { SESSION_MAX_AGE_SECONDS } from "./tokens";

/** Cookie da sessão da área do cliente. Sem dependências de servidor: o proxy usa. */
export const ACCOUNT_COOKIE = "conta_sess";

export const ACCOUNT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
