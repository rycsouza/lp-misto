import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Foto do sócio nas actions: leitura só devolve URL validada do Cloudinary do projeto;
 * remoção da PRÓPRIA foto (sócio do e-mail da sessão, nunca id do cliente); remoção pelo
 * admin só com a guarda do módulo socios (admin, ou editor com a permissão, e kill-switch).
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const OTHER_MEMBER_ID = "9a9f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e99";
const PUBLIC_ID = "clube-a/socios/fotos/antiga1";
const OK_URL =
  "https://res.cloudinary.com/misto-test/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/antiga1";

const h = vi.hoisted(() => ({
  session: null as unknown,
  adminSession: null as unknown,
  disabledModules: [] as string[],
  member: null as unknown,
  lookups: [] as string[],
  limited: false,
  adminRow: [] as unknown[],
  dbUsed: false,
}));

vi.mock("@/lib/accounts/session", () => ({
  getCustomerAccount: async () => h.session,
}));
vi.mock("@/lib/membership/my-member", () => ({
  findMemberByAccountEmail: async (email: string) => {
    h.lookups.push(email);
    return h.member;
  },
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => "clube-a",
}));
const removeStored = vi.hoisted(() =>
  vi.fn<(input: { memberId: string; tenantSlug: string | null; previousPublicId: string | null }) => Promise<void>>(async () => {})
);
vi.mock("@/lib/membership/member-photo-service", () => ({
  removeStoredMemberPhoto: removeStored,
}));
vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.adminSession }));
vi.mock("@/lib/platform/module-gate", () => ({
  isModuleDisabledForClub: async (key: string) => h.disabledModules.includes(key),
  MODULE_DISABLED_MESSAGE: "Módulo desativado para este clube.",
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => h.adminRow,
          }),
        }),
      }),
    };
  },
}));
const logAuditMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { getMyPhoto, removeMemberPhotoAdmin, removeMyPhoto } from "./member-photo";

const ACCOUNT = { id: "acc-1", email: "Socio@Example.com", name: "Maria Souza" };
const ADMIN_CLUBE = { role: "admin", permissions: {} };
const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };

beforeEach(() => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "misto-test");
  Object.assign(h, {
    session: ACCOUNT,
    adminSession: null,
    disabledModules: [],
    member: { id: MEMBER_ID, name: "Maria S.", photoUrl: OK_URL, photoPublicId: PUBLIC_ID },
    lookups: [],
    limited: false,
    adminRow: [{ id: MEMBER_ID, photoPublicId: PUBLIC_ID }],
    dbUsed: false,
  });
  removeStored.mockClear();
  logAuditMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getMyPhoto", () => {
  it("sem sessão: não devolve foto", async () => {
    h.session = null;
    expect(await getMyPhoto()).toEqual({ ok: false });
  });

  it("devolve a URL do projeto e nada além dela (sem public_id)", async () => {
    const r = await getMyPhoto();
    expect(r).toEqual({ ok: true, photoUrl: OK_URL });
    expect(Object.keys(r).sort()).toEqual(["ok", "photoUrl"]);
  });

  it("URL gravada fora do Cloudinary do projeto vira null (nunca é renderizada)", async () => {
    h.member = { id: MEMBER_ID, name: "Maria S.", photoUrl: "https://evil.test/x.png", photoPublicId: null };
    expect(await getMyPhoto()).toEqual({ ok: true, photoUrl: null });
  });

  it("sem sócio com o e-mail da sessão: sem foto", async () => {
    h.member = null;
    expect(await getMyPhoto()).toEqual({ ok: true, photoUrl: null });
  });
});

describe("removeMyPhoto — só a própria foto", () => {
  it("sem sessão: recusa antes de qualquer consulta", async () => {
    h.session = null;
    const r = await removeMyPhoto();
    expect(r.ok).toBe(false);
    expect(h.lookups).toEqual([]);
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("remove a foto do sócio do e-mail da sessão (e-mail normalizado, id vindo do banco)", async () => {
    const r = await removeMyPhoto();
    expect(r).toEqual({ ok: true });
    expect(h.lookups).toEqual([ACCOUNT.email]);
    expect(removeStored).toHaveBeenCalledWith({
      memberId: MEMBER_ID,
      tenantSlug: "clube-a",
      previousPublicId: PUBLIC_ID,
    });
  });

  it("não aceita argumento: não há como apontar outro sócio", async () => {
    expect(removeMyPhoto.length).toBe(0);
    await removeMyPhoto();
    const ids = removeStored.mock.calls.map((c) => c[0].memberId);
    expect(ids).toEqual([MEMBER_ID]);
    expect(ids).not.toContain(OTHER_MEMBER_ID);
  });

  it("sem sócio: recusa sem mexer em nada", async () => {
    h.member = null;
    const r = await removeMyPhoto();
    expect(r.ok).toBe(false);
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("sem foto guardada: já está removida, sem chamar o armazenamento", async () => {
    h.member = { id: MEMBER_ID, name: "Maria S.", photoUrl: null, photoPublicId: null };
    expect(await removeMyPhoto()).toEqual({ ok: true });
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("limite de alterações atingido: recusa", async () => {
    h.limited = true;
    const r = await removeMyPhoto();
    expect(r.ok).toBe(false);
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("erro interno: mensagem genérica, sem detalhe", async () => {
    removeStored.mockRejectedValueOnce(new Error("conexão com senha=abc"));
    const r = await removeMyPhoto();
    expect(r).toEqual({ ok: false, error: "Não foi possível remover a foto agora. Tente de novo." });
    expect(JSON.stringify(r)).not.toContain("senha");
  });
});

describe("removeMemberPhotoAdmin — moderação com guarda do módulo", () => {
  it("sem sessão de admin: 'Não autorizado' antes do banco", async () => {
    h.adminSession = null;
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({ success: false, error: "Não autorizado" });
    expect(h.dbUsed).toBe(false);
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("editor sem a permissão socios: recusa antes do banco", async () => {
    h.adminSession = EDITOR_OUTRO;
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({ success: false, error: "Não autorizado" });
    expect(h.dbUsed).toBe(false);
  });

  it("módulo socios desligado para o clube: recusa, inclusive para admin", async () => {
    h.disabledModules = ["socios"];
    for (const session of [ADMIN_CLUBE, EDITOR_SOCIOS]) {
      h.adminSession = session;
      expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({
        success: false,
        error: "Módulo desativado para este clube.",
      });
    }
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("id que não é UUID: recusa antes do banco", async () => {
    h.adminSession = ADMIN_CLUBE;
    expect(await removeMemberPhotoAdmin("' OR 1=1 --")).toEqual({ success: false, error: "Sócio inválido." });
    expect(h.dbUsed).toBe(false);
  });

  it("sócio inexistente: recusa sem remover nada", async () => {
    h.adminSession = ADMIN_CLUBE;
    h.adminRow = [];
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({ success: false, error: "Sócio não encontrado." });
    expect(removeStored).not.toHaveBeenCalled();
  });

  it("admin com permissão: remove a foto do sócio indicado e audita só o id", async () => {
    h.adminSession = ADMIN_CLUBE;
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({ success: true });
    expect(removeStored).toHaveBeenCalledWith({
      memberId: MEMBER_ID,
      tenantSlug: "clube-a",
      previousPublicId: PUBLIC_ID,
    });
    expect(logAuditMock).toHaveBeenCalledWith("member_photo_remove", "member", MEMBER_ID);
    const auditArgs = JSON.stringify(logAuditMock.mock.calls);
    expect(auditArgs).not.toContain(PUBLIC_ID);
    expect(auditArgs).not.toContain("res.cloudinary");
  });

  it("editor com a permissão socios: pode remover", async () => {
    h.adminSession = EDITOR_SOCIOS;
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({ success: true });
  });

  it("falha no armazenamento: erro genérico e sem auditoria de sucesso", async () => {
    h.adminSession = ADMIN_CLUBE;
    removeStored.mockRejectedValueOnce(new Error("falha"));
    expect(await removeMemberPhotoAdmin(MEMBER_ID)).toEqual({
      success: false,
      error: "Não foi possível remover a foto agora.",
    });
    expect(logAuditMock).not.toHaveBeenCalled();
  });
});
