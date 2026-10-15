import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Visual da carteirinha: `updateMemberCardBackgroundAdmin` (action própria, módulo socios).
 *
 * Guarda: admin, ou editor com a permissão "socios"; kill-switch do módulo vale para todos.
 * Entrada estrita (campo extra recusa), URL só do destino de upload do projeto ou caminho
 * relativo do site, fit e opacidade validados. Grava SÓ as 3 chaves do fundo, e nada é
 * gravado quando a entrada é recusada.
 */
const URL_OK = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo.png";

const h = vi.hoisted(() => ({
  session: null as unknown,
  disabledModules: [] as string[],
  writes: [] as { key: string; value: string; type: string }[],
  dbUsed: false,
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/platform/module-gate", () => ({
  isModuleDisabledForClub: async (key: string) => h.disabledModules.includes(key),
  MODULE_DISABLED_MESSAGE: "Módulo desativado para este clube.",
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    h.dbUsed = true;
    return {
      insert: () => ({
        values: (v: { key: string; value: string; type: string }) => ({
          onConflictDoUpdate: async () => {
            h.writes.push({ key: v.key, value: v.value, type: v.type });
          },
        }),
      }),
    };
  },
}));
vi.mock("@/lib/db/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries")>()),
  currentTenantSlug: async () => "misto",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { updateMemberCardBackgroundAdmin } from "./membership";
import { logAudit } from "@/lib/audit";

const ADMIN_CLUBE = { role: "admin", permissions: {} };
const ADMIN_SISTEMA = { role: "admin", permissions: {}, isPlatform: true };
const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };
const EDITOR_OUTRO = { role: "editor", permissions: { jogos: true } };

const VALID = { url: URL_OK, fit: "contain", opacity: 60 } as const;

beforeEach(() => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "misto-test");
  Object.assign(h, { session: null, disabledModules: [], writes: [], dbUsed: false });
  vi.mocked(logAudit).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateMemberCardBackgroundAdmin — autorização", () => {
  it("sem sessão → bloqueia antes do banco", async () => {
    h.session = null;
    expect(await updateMemberCardBackgroundAdmin(VALID)).toEqual({ success: false, error: "Não autorizado" });
    expect(h.dbUsed).toBe(false);
    expect(h.writes).toEqual([]);
  });

  it("editor sem a permissão socios → bloqueia antes do banco", async () => {
    h.session = EDITOR_OUTRO;
    expect(await updateMemberCardBackgroundAdmin(VALID)).toEqual({ success: false, error: "Não autorizado" });
    expect(h.dbUsed).toBe(false);
    expect(h.writes).toEqual([]);
  });

  it("módulo socios desligado para o clube → recusa, inclusive para admin do sistema", async () => {
    h.disabledModules = ["socios"];
    for (const session of [ADMIN_CLUBE, ADMIN_SISTEMA, EDITOR_SOCIOS]) {
      h.session = session;
      expect(await updateMemberCardBackgroundAdmin(VALID)).toEqual({
        success: false,
        error: "Módulo desativado para este clube.",
      });
    }
    expect(h.writes).toEqual([]);
  });

  it("editor com a permissão socios grava", async () => {
    h.session = EDITOR_SOCIOS;
    expect(await updateMemberCardBackgroundAdmin(VALID)).toEqual({ success: true });
    expect(h.writes).toHaveLength(3);
  });

  it("admin do clube grava", async () => {
    h.session = ADMIN_CLUBE;
    expect(await updateMemberCardBackgroundAdmin(VALID)).toEqual({ success: true });
  });
});

describe("updateMemberCardBackgroundAdmin — entrada inválida não grava nada", () => {
  beforeEach(() => {
    h.session = EDITOR_SOCIOS;
  });

  it("campo extra (ex.: clubLogoUrl ou role) é recusado: mass assignment", async () => {
    for (const extra of [{ clubLogoUrl: "https://x.test/l.png" }, { role: "admin" }, { isPlatform: true }]) {
      expect(await updateMemberCardBackgroundAdmin({ ...VALID, ...extra })).toEqual({
        success: false,
        error: "Visual inválido.",
      });
    }
    expect(h.writes).toEqual([]);
  });

  it("fit fora do enum e opacidade fora da faixa ou não inteira", async () => {
    for (const bad of [
      { ...VALID, fit: "stretch" },
      { ...VALID, opacity: 9 },
      { ...VALID, opacity: 101 },
      { ...VALID, opacity: 50.5 },
      { ...VALID, opacity: "50" },
    ]) {
      expect((await updateMemberCardBackgroundAdmin(bad)).success).toBe(false);
    }
    expect(h.writes).toEqual([]);
  });

  it("payload que não é objeto ou está sem campos", async () => {
    expect((await updateMemberCardBackgroundAdmin(null)).success).toBe(false);
    expect((await updateMemberCardBackgroundAdmin("x")).success).toBe(false);
    expect((await updateMemberCardBackgroundAdmin({})).success).toBe(false);
    expect(h.writes).toEqual([]);
  });

  it.each([
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "http://res.cloudinary.com/misto-test/image/upload/a.png",
    "https://evil.example/a.png",
    "https://res.cloudinary.com/outro-clube/image/upload/a.png",
    "//evil.example/a.png",
  ])("URL recusada (%s): mensagem genérica e nada gravado", async (url) => {
    const r = await updateMemberCardBackgroundAdmin({ ...VALID, url });
    expect(r.success).toBe(false);
    expect(r.error).toBe("Endereço de imagem não aceito. Envie a imagem pelo botão de envio.");
    expect(h.writes).toEqual([]);
  });

  it("sem CLOUDINARY_CLOUD_NAME, nenhuma URL https é aceita (fail closed)", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    expect((await updateMemberCardBackgroundAdmin(VALID)).success).toBe(false);
    expect(h.writes).toEqual([]);
  });
});

describe("updateMemberCardBackgroundAdmin — sucesso", () => {
  beforeEach(() => {
    h.session = ADMIN_CLUBE;
  });

  it("grava as 3 chaves do fundo, com tipos corretos, e nenhuma outra", async () => {
    await updateMemberCardBackgroundAdmin(VALID);
    expect(h.writes).toEqual([
      { key: "memberCardBackgroundUrl", value: URL_OK, type: "string" },
      { key: "memberCardBackgroundFit", value: "contain", type: "string" },
      { key: "memberCardBackgroundOpacity", value: "60", type: "number" },
    ]);
  });

  it("URL vazia remove o fundo (grava vazio, não recusa)", async () => {
    expect(await updateMemberCardBackgroundAdmin({ url: "", fit: "cover", opacity: 100 })).toEqual({ success: true });
    expect(h.writes[0]).toEqual({ key: "memberCardBackgroundUrl", value: "", type: "string" });
  });

  it("caminho relativo do próprio site é aceito", async () => {
    expect(await updateMemberCardBackgroundAdmin({ ...VALID, url: "/fundos/carteirinha.png" })).toEqual({ success: true });
    expect(h.writes[0].value).toBe("/fundos/carteirinha.png");
  });

  it("auditoria registra só as chaves, sem a URL", async () => {
    await updateMemberCardBackgroundAdmin(VALID);
    expect(logAudit).toHaveBeenCalledWith("member_card_background_update", "site_config", null, {
      keys: ["memberCardBackgroundUrl", "memberCardBackgroundFit", "memberCardBackgroundOpacity"],
    });
    expect(JSON.stringify(vi.mocked(logAudit).mock.calls)).not.toContain(URL_OK);
  });
});
