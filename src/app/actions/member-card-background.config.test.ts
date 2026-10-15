import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Chaves do fundo da carteirinha pelo caminho genérico `updateConfigValues`.
 *
 * O admin do clube (role admin) pode gravar essas chaves, então o VALOR também é checado
 * aqui: URL só do destino de upload (ou caminho relativo), fit do enum, opacidade 10–100.
 * Lote com qualquer valor inválido não grava nada, nem as outras chaves do lote.
 */
const URL_OK = "https://res.cloudinary.com/misto-test/image/upload/v1/misto/fundo.png";

const h = vi.hoisted(() => ({
  session: null as unknown,
  writes: [] as { key: string; value: string }[],
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: async () => [] }) }),
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

import { updateConfigValues } from "@/app/actions/admin";
import { logAudit } from "@/lib/audit";

const CLUBE = { role: "admin", permissions: {} };
const EDITOR_SOCIOS = { role: "editor", permissions: { socios: true } };

beforeEach(() => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "misto-test");
  h.session = null;
  h.writes = [];
  vi.mocked(logAudit).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateConfigValues — fundo da carteirinha, admin do clube", () => {
  beforeEach(() => {
    h.session = CLUBE;
  });

  it("grava as 3 chaves com valores válidos", async () => {
    await updateConfigValues({
      memberCardBackgroundUrl: URL_OK,
      memberCardBackgroundFit: "contain",
      memberCardBackgroundOpacity: "70",
    });
    expect(h.writes).toEqual([
      { key: "memberCardBackgroundUrl", value: URL_OK },
      { key: "memberCardBackgroundFit", value: "contain" },
      { key: "memberCardBackgroundOpacity", value: "70" },
    ]);
  });

  it("URL vazia (remover) é aceita", async () => {
    await updateConfigValues({ memberCardBackgroundUrl: "" });
    expect(h.writes).toEqual([{ key: "memberCardBackgroundUrl", value: "" }]);
  });

  it.each([
    ["memberCardBackgroundUrl", "javascript:alert(1)"],
    ["memberCardBackgroundUrl", "data:text/html,<script>1</script>"],
    ["memberCardBackgroundUrl", "http://res.cloudinary.com/misto-test/image/upload/a.png"],
    ["memberCardBackgroundUrl", "https://evil.example/a.png"],
    ["memberCardBackgroundFit", "stretch"],
    ["memberCardBackgroundOpacity", "5"],
    ["memberCardBackgroundOpacity", "101"],
    ["memberCardBackgroundOpacity", "abc"],
  ])("valor inválido de %s (%s) recusa o lote inteiro, sem gravar nada", async (key, value) => {
    await expect(updateConfigValues({ siteName: "Misto EC", [key]: value })).rejects.toThrow("Dados inválidos.");
    expect(h.writes).toEqual([]);
    expect(logAudit).toHaveBeenCalledWith("config_denied", "site_config", null, {
      motivo: "valor_invalido",
      keys: [key],
    });
  });

  it("a auditoria de recusa não grava o valor enviado", async () => {
    await expect(
      updateConfigValues({ memberCardBackgroundUrl: "javascript:alert('segredo-do-valor')" }),
    ).rejects.toThrow("Dados inválidos.");
    expect(JSON.stringify(vi.mocked(logAudit).mock.calls)).not.toContain("segredo-do-valor");
  });
});

describe("updateConfigValues — papel e chave desconhecida continuam como antes", () => {
  it("editor, mesmo com a permissão socios, não grava pelo caminho genérico (exige admin)", async () => {
    h.session = EDITOR_SOCIOS;
    await expect(updateConfigValues({ memberCardBackgroundFit: "contain" })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });

  it("chave parecida com a do fundo, mas inexistente, é recusada", async () => {
    h.session = CLUBE;
    await expect(updateConfigValues({ memberCardBackgroundPrice: "1" })).rejects.toThrow("Não autorizado.");
    expect(h.writes).toEqual([]);
  });
});
