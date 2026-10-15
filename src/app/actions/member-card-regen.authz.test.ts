import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Admin "Gerar nova carteirinha": mesma guarda de módulo das outras ações de sócio
 * (requireModule "socios"), id validado com zod, auditoria só com o id (nunca o token),
 * resposta sem token.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OLD_TOKEN = "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const h = vi.hoisted(() => ({
  session: null as unknown,
  row: null as unknown,
  dbUsed: false,
  updates: [] as Record<string, unknown>[],
  updateRows: [] as unknown[],
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "from", "where"]) chain[m] = () => chain;
    chain.limit = async () => (h.row ? [h.row] : []);
    return {
      select: () => chain,
      update: () => ({
        set: (values: Record<string, unknown>) => {
          h.updates.push(values);
          return { where: () => ({ returning: async () => h.updateRows }) };
        },
      }),
    };
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { regenerateMemberCardAdmin } from "./membership";
import { logAudit } from "@/lib/audit";

const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };
const ADMIN = { role: "admin", permissions: {} };
const MEMBER_WITH_CARD = { id: MEMBER_ID, memberCardToken: OLD_TOKEN };

beforeEach(() => {
  Object.assign(h, { session: null, row: null, dbUsed: false, updates: [], updateRows: [{ id: MEMBER_ID }] });
  vi.mocked(logAudit).mockClear();
});

describe("regenerateMemberCardAdmin — autorização", () => {
  it("sessão ausente → bloqueia antes do banco", async () => {
    h.session = null;
    await expect(regenerateMemberCardAdmin(MEMBER_ID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("editor sem o módulo socios → bloqueia antes do banco", async () => {
    h.session = EDITOR_OUTRO;
    await expect(regenerateMemberCardAdmin(MEMBER_ID)).rejects.toThrow("Não autorizado");
    expect(h.dbUsed).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("editor com o módulo socios passa da guarda e gera a carteirinha", async () => {
    h.session = EDITOR_SOCIOS;
    h.row = MEMBER_WITH_CARD;
    expect(await regenerateMemberCardAdmin(MEMBER_ID)).toEqual({ success: true });
    expect(h.updates).toHaveLength(1);
  });
});

describe("regenerateMemberCardAdmin — validação e estado", () => {
  it("id inválido → recusa sem tocar no banco", async () => {
    h.session = ADMIN;
    expect(await regenerateMemberCardAdmin("abc")).toEqual({ success: false, error: "Sócio inválido." });
    expect(await regenerateMemberCardAdmin("' OR 1=1 --")).toEqual({ success: false, error: "Sócio inválido." });
    expect(h.dbUsed).toBe(false);
    expect(h.updates).toEqual([]);
  });

  it("sócio inexistente → recusa sem gravar", async () => {
    h.session = ADMIN;
    h.row = null;
    expect(await regenerateMemberCardAdmin(MEMBER_ID)).toEqual({ success: false, error: "Sócio não encontrado." });
    expect(h.updates).toEqual([]);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("sócio sem carteirinha ainda → recusa sem criar token", async () => {
    h.session = ADMIN;
    h.row = { id: MEMBER_ID, memberCardToken: null };
    const r = await regenerateMemberCardAdmin(MEMBER_ID);
    expect(r.success).toBe(false);
    expect(h.updates).toEqual([]);
    expect(logAudit).not.toHaveBeenCalled();
  });
});

describe("regenerateMemberCardAdmin — sucesso", () => {
  it("grava token novo (uuid) ≠ antigo e audita só com o id", async () => {
    h.session = ADMIN;
    h.row = MEMBER_WITH_CARD;
    const r = await regenerateMemberCardAdmin(MEMBER_ID);
    expect(r).toEqual({ success: true });
    const novo = h.updates[0].memberCardToken as string;
    expect(novo).toMatch(UUID_RE);
    expect(novo).not.toBe(OLD_TOKEN);
    expect(logAudit).toHaveBeenCalledWith("member_card_regenerate", "member", MEMBER_ID);
  });

  it("nem a resposta nem a auditoria carregam o token", async () => {
    h.session = ADMIN;
    h.row = MEMBER_WITH_CARD;
    const r = await regenerateMemberCardAdmin(MEMBER_ID);
    const novo = h.updates[0].memberCardToken as string;
    const trilha = JSON.stringify([r, vi.mocked(logAudit).mock.calls]);
    expect(trilha).not.toContain(OLD_TOKEN);
    expect(trilha).not.toContain(novo);
  });
});
