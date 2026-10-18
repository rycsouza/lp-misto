import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Chaves do app Android (androidPackageName, androidCertFingerprints) pelo caminho de
 * `updateConfigValues`: só o admin do SISTEMA grava. Admin do clube recebe "Não autorizado."
 * (mesmo com a aba escondida, o servidor barra). Valor inválido recusa o lote inteiro.
 */
const FP_A = Array.from({ length: 32 }, (_, i) => ((0x0a + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_B = Array.from({ length: 32 }, (_, i) => ((0x1b + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_C = Array.from({ length: 32 }, (_, i) => ((0x2c + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_D = Array.from({ length: 32 }, (_, i) => ((0x3d + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_E = Array.from({ length: 32 }, (_, i) => ((0x4e + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");
const FP_F = Array.from({ length: 32 }, (_, i) => ((0x5f + i * 7) & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(":");

const h = vi.hoisted(() => ({
  session: null as unknown,
  rows: [] as { key: string; value: string }[],
  writes: [] as { key: string; value: string }[],
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: async () => h.rows, orderBy: async () => h.rows }),
    }),
    insert: () => ({
      values: (v: { key: string; value: string }) => ({
        onConflictDoUpdate: async () => {
          h.writes.push({ key: v.key, value: v.value });
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/db/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/queries")>()),
  currentTenantSlug: async () => "misto",
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

import { getAdminConfigRows, updateConfigValues } from "@/app/actions/admin";
import { logAudit } from "@/lib/audit";

const CLUBE = { role: "admin", permissions: {} };
const SISTEMA = { role: "admin", permissions: {}, isPlatform: true };
const EDITOR_TUDO = { role: "editor", permissions: { configuracoes: true } };

const PKG_ATUAL = "com.misto.app";
const FP_ATUAL = JSON.stringify([FP_A]);

beforeEach(() => {
  h.session = null;
  h.rows = [
    { key: "androidPackageName", value: PKG_ATUAL },
    { key: "androidCertFingerprints", value: FP_ATUAL },
  ];
  h.writes = [];
  vi.mocked(logAudit).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin do clube: não grava o app Android", () => {
  beforeEach(() => {
    h.session = CLUBE;
  });

  it("pacote com valor diferente: recusa e não grava nada", async () => {
    await expect(
      updateConfigValues({ siteName: "Misto EC", androidPackageName: "com.outro.app" }),
    ).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("impressões com valor diferente: recusa e não grava nada", async () => {
    await expect(
      updateConfigValues({ androidCertFingerprints: JSON.stringify([FP_B]) }),
    ).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("chave nova (sem linha no banco) também é recusada", async () => {
    h.rows = [];
    await expect(updateConfigValues({ androidPackageName: PKG_ATUAL })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("valor igual ao atual é ignorado (como os hidden de mídia): não grava", async () => {
    await updateConfigValues({
      siteName: "Misto EC",
      androidPackageName: PKG_ATUAL,
      androidCertFingerprints: FP_ATUAL,
    });
    expect(h.writes).toEqual([{ key: "siteName", value: "Misto EC" }]);
  });

  it("valor inválido nas chaves do app: recusa com Dados inválidos e não grava nada", async () => {
    await expect(
      updateConfigValues({ siteName: "Misto EC", androidPackageName: "sem ponto" }),
    ).rejects.toThrow("Dados inválidos.");
    expect(h.writes).toEqual([]);
  });
});

describe("admin do sistema: grava o app Android", () => {
  beforeEach(() => {
    h.session = SISTEMA;
  });

  it("grava pacote e lista de impressões (JSON) com valores válidos", async () => {
    const lista = JSON.stringify([FP_A, FP_B]);
    await updateConfigValues({ androidPackageName: "com.misto.app", androidCertFingerprints: lista });
    expect(h.writes).toEqual([
      { key: "androidPackageName", value: "com.misto.app" },
      { key: "androidCertFingerprints", value: lista },
    ]);
  });

  it("aceita até 5 impressões", async () => {
    const lista = JSON.stringify([FP_A, FP_B, FP_C, FP_D, FP_E]);
    await updateConfigValues({ androidCertFingerprints: lista });
    expect(h.writes).toEqual([{ key: "androidCertFingerprints", value: lista }]);
  });

  it("vazio remove a configuração", async () => {
    await updateConfigValues({ androidPackageName: "", androidCertFingerprints: "" });
    expect(h.writes).toEqual([
      { key: "androidPackageName", value: "" },
      { key: "androidCertFingerprints", value: "" },
    ]);
  });

  it.each([
    ["pacote sem ponto", { androidPackageName: "comapp" }],
    ["pacote com aspas e tag", { androidPackageName: 'com.a"><script>' }],
    ["pacote com 101 caracteres", { androidPackageName: "a." + "b".repeat(99) }],
    ["impressão em minúsculas (não canônica)", { androidCertFingerprints: JSON.stringify([FP_A.toLowerCase()]) }],
    ["seis impressões", { androidCertFingerprints: JSON.stringify([FP_A, FP_B, FP_C, FP_D, FP_E, FP_F]) }],
    ["impressão repetida", { androidCertFingerprints: JSON.stringify([FP_A, FP_A]) }],
    ["lista vazia", { androidCertFingerprints: "[]" }],
    ["texto puro em vez de lista", { androidCertFingerprints: FP_A }],
  ])("recusa %s e não grava nem a outra chave do lote", async (_label, extra) => {
    await expect(updateConfigValues({ siteName: "Misto EC", ...extra })).rejects.toThrow("Dados inválidos.");
    expect(h.writes).toEqual([]);
  });

  it("a auditoria da recusa registra só o nome da chave, nunca o valor", async () => {
    await expect(
      updateConfigValues({ androidPackageName: "segredo-do-valor" }),
    ).rejects.toThrow("Dados inválidos.");
    expect(logAudit).toHaveBeenCalledWith("config_denied", "site_config", null, {
      motivo: "valor_invalido",
      keys: ["androidPackageName"],
    });
    expect(JSON.stringify(vi.mocked(logAudit).mock.calls)).not.toContain("segredo-do-valor");
  });
});

describe("papéis sem permissão de configuração", () => {
  it("editor com permissão de configurações não grava o app Android", async () => {
    h.session = EDITOR_TUDO;
    await expect(updateConfigValues({ androidPackageName: "com.outro.app" })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("sessão ausente não grava", async () => {
    h.session = null;
    await expect(updateConfigValues({ androidCertFingerprints: JSON.stringify([FP_A]) })).rejects.toThrow(
      "Não autorizado.",
    );
    expect(h.writes).toEqual([]);
  });
});

describe("getAdminConfigRows: leitura da configuração exige admin", () => {
  it("sessão ausente: recusa e não lê a configuração", async () => {
    h.session = null;
    await expect(getAdminConfigRows()).rejects.toThrow("Não autorizado");
  });

  it("editor, mesmo com permissão de configurações: recusa", async () => {
    h.session = EDITOR_TUDO;
    await expect(getAdminConfigRows()).rejects.toThrow("Não autorizado");
  });

  it("admin do clube lê as linhas; a chave de convite de atleta continua só no servidor", async () => {
    h.session = CLUBE;
    h.rows = [{ key: "athlete_invite_code", value: "CODIGO-SECRETO" }];
    const rows = await getAdminConfigRows();
    expect(rows).toEqual(h.rows);
  });
});
