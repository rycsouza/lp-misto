import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Admin de sócios: consultar/reenviar exigem o módulo "socios"; CANCELAR e
 * ATIVAR MANUALMENTE (mexem em cobrança/benefício) exigem perfil admin — editor
 * com o módulo é barrado ANTES do banco. CPF sai mascarado no detalhe.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const h = vi.hoisted(() => ({ session: null as unknown, row: null as unknown, dbUsed: false }));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "leftJoin"]) chain[m] = () => chain;
  chain.limit = async () => (h.row ? [h.row] : []);
  return {
    getDb: async () => {
      h.dbUsed = true;
      return chain;
    },
  };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import {
  activateMemberById,
  cancelMemberAdmin,
  getAdminMemberDetail,
  getAdminMemberPayments,
  resendMemberCardAdmin,
} from "./membership";

const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };
const ADMIN = { role: "admin", permissions: {} };

beforeEach(() => {
  h.session = null;
  h.row = null;
  h.dbUsed = false;
});

describe("ações só de admin (cancelar / ativar manualmente)", () => {
  for (const [label, session] of [
    ["sessão ausente", null],
    ["editor COM o módulo socios", EDITOR_SOCIOS],
  ] as const) {
    it(`cancelMemberAdmin bloqueia ${label}`, async () => {
      h.session = session;
      await expect(cancelMemberAdmin(MEMBER_ID)).rejects.toThrow("Não autorizado");
      expect(h.dbUsed).toBe(false);
    });
    it(`activateMemberById bloqueia ${label}`, async () => {
      h.session = session;
      await expect(activateMemberById(MEMBER_ID)).rejects.toThrow("Não autorizado");
      expect(h.dbUsed).toBe(false);
    });
  }

  it("admin passa da guarda; id inválido é rejeitado", async () => {
    h.session = ADMIN;
    expect(await cancelMemberAdmin("abc")).toMatchObject({ success: false });
    await expect(activateMemberById("abc")).rejects.toThrow("Sócio inválido");
  });
});

describe("consultas do módulo socios", () => {
  for (const [name, fn] of [
    ["getAdminMemberDetail", () => getAdminMemberDetail(MEMBER_ID)],
    ["getAdminMemberPayments", () => getAdminMemberPayments(MEMBER_ID)],
    ["resendMemberCardAdmin", () => resendMemberCardAdmin(MEMBER_ID)],
  ] as const) {
    it(`${name} bloqueia editor sem o módulo`, async () => {
      h.session = EDITOR_OUTRO;
      await expect(fn()).rejects.toThrow("Não autorizado");
      expect(h.dbUsed).toBe(false);
    });
  }

  it("detalhe mascara o CPF e expõe o link da carteirinha", async () => {
    h.session = EDITOR_SOCIOS;
    h.row = {
      id: MEMBER_ID,
      name: "Titular Exemplo",
      email: "titular@example.com",
      whatsapp: "5511900000000",
      cpf: "52998224725",
      status: "active",
      createdAt: new Date("2026-01-01"),
      nextBillingDate: null,
      cancelledAt: null,
      gatewaySlug: "asaas",
      subscriptionId: "sub_1",
      memberCardToken: "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f",
      planName: "Ouro",
      planPriceCents: 2990,
    };
    const d = await getAdminMemberDetail(MEMBER_ID);
    expect(d?.cpfMasked).toBe("***.982.***-**");
    expect(JSON.stringify(d)).not.toContain("52998224725");
    expect(d?.cardPath).toBe("/socios/carteirinha?token=5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f");
  });
});
