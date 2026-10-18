import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Código de convite do cadastro de atletas: nunca lido por endpoint público.
 * Admin lê só com permissão de Elenco; a verificação pública só diz se confere,
 * com limite de tentativas (anti-adivinhação).
 */
const h = vi.hoisted(() => ({ code: "segredo123", allowed: true, limited: false, dbReads: 0 }));

vi.mock("@/lib/athletes/invite-code", async (orig) => {
  const real = await orig<typeof import("@/lib/athletes/invite-code")>();
  return {
    ...real,
    readAthleteInviteCode: async () => {
      h.dbReads++;
      return h.code;
    },
  };
});
vi.mock("@/lib/admin/auth-guard", () => ({
  requireModule: async () => {
    if (!h.allowed) throw new Error("Não autorizado");
    return { role: "admin" };
  },
}));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.5",
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("@/lib/db/client", () => ({ getDb: async () => ({}) }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import * as actions from "./athletes";

beforeEach(() => {
  h.code = "segredo123";
  h.allowed = true;
  h.limited = false;
  h.dbReads = 0;
});

describe("código de convite de atletas", () => {
  it("não existe mais action pública que devolva o código", () => {
    expect((actions as Record<string, unknown>).getAthleteInviteCode).toBeUndefined();
  });

  it("admin sem permissão de Elenco não lê o código", async () => {
    h.allowed = false;
    await expect(actions.getAthleteInviteCodeAdmin()).rejects.toThrow("Não autorizado");
    expect(h.dbReads).toBe(0);
  });

  it("admin com permissão lê", async () => {
    expect(await actions.getAthleteInviteCodeAdmin()).toBe("segredo123");
  });

  it("verificação pública só responde válido/inválido e nunca o código", async () => {
    expect(await actions.verifyAthleteInviteCode(" SEGREDO123 ")).toEqual({ valid: true });
    const wrong = await actions.verifyAthleteInviteCode("chute");
    expect(wrong).toEqual({ valid: false });
    expect(JSON.stringify(wrong)).not.toContain("segredo");
  });

  it("limite de tentativas estourado → inválido sem consultar", async () => {
    h.limited = true;
    expect(await actions.verifyAthleteInviteCode("segredo123")).toEqual({ valid: false });
    expect(h.dbReads).toBe(0);
  });
});
