import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Armazenamento do logo do sócio: sobe SÓ para a pasta de logos do clube, encaixado (sem recorte),
 * em PNG com fundo transparente; grava a URL de entrega e o public_id; apaga o logo anterior só se
 * for deste clube; não deixa órfão quando o banco falha; nunca devolve detalhe do Cloudinary.
 */
const h = vi.hoisted(() => ({
  uploads: [] as { data: string; opts: Record<string, unknown> }[],
  destroys: [] as string[],
  uploadResult: { public_id: "clube-a/socios/logos/novo1" } as { public_id: string },
  uploadError: null as Error | null,
  destroyError: null as Error | null,
  dbWrites: [] as Record<string, unknown>[],
  dbWheres: 0,
  dbError: null as Error | null,
  dbRowsUpdated: 1,
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: () => {},
    uploader: {
      upload: async (data: string, opts: Record<string, unknown>) => {
        h.uploads.push({ data: data.slice(0, 40), opts });
        if (h.uploadError) throw h.uploadError;
        return h.uploadResult;
      },
      destroy: async (publicId: string) => {
        h.destroys.push(publicId);
        if (h.destroyError) throw h.destroyError;
        return { result: "ok" };
      },
    },
  },
}));

vi.mock("@/lib/db/client", () => ({
  getDb: async () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          const run = async () => {
            if (h.dbError) throw h.dbError;
            if (h.dbRowsUpdated === 0) return [];
            h.dbWrites.push(values);
            return [{ id: "linha" }];
          };
          return { returning: run, then: (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) => run().then(ok, fail) };
        },
      }),
    }),
  }),
}));

import { removeStoredMemberLogo, storeMemberLogo } from "./member-logo-service";
import { MEMBER_LOGO_TRANSFORM } from "./member-logo";

const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const OLD_ID = "clube-a/socios/logos/antiga1";
const NEW_URL = `https://res.cloudinary.com/misto-test/image/upload/${MEMBER_LOGO_TRANSFORM}/clube-a/socios/logos/novo1`;

beforeEach(() => {
  h.uploads = [];
  h.destroys = [];
  h.uploadResult = { public_id: "clube-a/socios/logos/novo1" };
  h.uploadError = null;
  h.destroyError = null;
  h.dbWrites = [];
  h.dbError = null;
  h.dbRowsUpdated = 1;
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "misto-test");
  vi.stubEnv("CLOUDINARY_API_KEY", "chave-de-teste");
  vi.stubEnv("CLOUDINARY_API_SECRET", "segredo-de-teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const input = (over: Partial<Parameters<typeof storeMemberLogo>[0]> = {}) => ({
  memberId: MEMBER_ID,
  tenantSlug: "clube-a",
  bytes: PNG,
  type: "image/png" as const,
  previousPublicId: null as string | null,
  ...over,
});

describe("storeMemberLogo", () => {
  it("sobe para <clube>/socios/logos, encaixado sem recorte, em PNG (transparência preservada)", async () => {
    const r = await storeMemberLogo(input());
    expect(r).toEqual({ ok: true, logoUrl: NEW_URL });
    const { data, opts } = h.uploads[0];
    expect(data.startsWith("data:image/png;base64,")).toBe(true);
    expect(opts).toMatchObject({
      folder: "clube-a/socios/logos",
      resource_type: "image",
      type: "upload",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      format: "png",
      // Objeto de parâmetros (nunca string) e encaixe sem recorte de rosto.
      transformation: [{ crop: "pad", width: 512, height: 512, background: "transparent" }],
    });
    expect(JSON.stringify(opts.transformation)).not.toMatch(/g_face|c_fill|crop":"fill/);
  });

  it("grava a URL de entrega do logo e o public_id (nunca a URL de upload crua, nunca em colunas de foto)", async () => {
    await storeMemberLogo(input());
    expect(h.dbWrites).toHaveLength(1);
    expect(h.dbWrites[0]).toMatchObject({ logoUrl: NEW_URL, logoPublicId: "clube-a/socios/logos/novo1" });
    expect(h.dbWrites[0]).not.toHaveProperty("photoUrl");
    expect(h.dbWrites[0]).not.toHaveProperty("photoPublicId");
  });

  it("troca: apaga o logo antigo (do mesmo clube) depois de gravar o novo", async () => {
    await storeMemberLogo(input({ previousPublicId: OLD_ID }));
    expect(h.destroys).toEqual([OLD_ID]);
  });

  it("não apaga um public_id de outro clube, nem de foto", async () => {
    await storeMemberLogo(input({ previousPublicId: "clube-b/socios/logos/antiga1" }));
    await storeMemberLogo(input({ previousPublicId: "clube-a/socios/fotos/antiga1" }));
    expect(h.destroys).toEqual([]);
  });

  it("falha no upload: recusa sem gravar e sem apagar o antigo", async () => {
    h.uploadError = new Error("cloudinary 500 com detalhe interno");
    expect(await storeMemberLogo(input({ previousPublicId: OLD_ID }))).toEqual({ ok: false });
    expect(h.dbWrites).toEqual([]);
    expect(h.destroys).toEqual([]);
  });

  it("falha no banco: apaga o logo recém-enviado (sem órfão) e mantém o antigo", async () => {
    h.dbError = new Error("conexão perdida");
    expect(await storeMemberLogo(input({ previousPublicId: OLD_ID }))).toEqual({ ok: false });
    expect(h.destroys).toEqual(["clube-a/socios/logos/novo1"]);
  });

  it("envio concorrente: se o logo guardado mudou antes da gravação, recusa e apaga o PRÓPRIO upload", async () => {
    h.dbRowsUpdated = 0;
    expect(await storeMemberLogo(input({ previousPublicId: OLD_ID }))).toEqual({ ok: false });
    expect(h.destroys).toEqual(["clube-a/socios/logos/novo1"]);
    expect(h.destroys).not.toContain(OLD_ID);
  });

  it("erro não vaza detalhe: o resultado é só { ok: false }", async () => {
    h.uploadError = new Error("segredo=abc chave=xyz");
    expect(JSON.stringify(await storeMemberLogo(input()))).toBe('{"ok":false}');
  });

  it("sem credenciais, ou sem clube válido: não sobe nada", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(await storeMemberLogo(input())).toEqual({ ok: false });
    expect(h.uploads).toEqual([]);
    vi.stubEnv("CLOUDINARY_API_SECRET", "segredo-de-teste");
    expect(await storeMemberLogo(input({ tenantSlug: null }))).toEqual({ ok: false });
    expect(await storeMemberLogo(input({ tenantSlug: "!!!" }))).toEqual({ ok: false });
    expect(h.uploads).toEqual([]);
  });

  it("public_id fora do formato: apaga o upload e recusa", async () => {
    h.uploadResult = { public_id: "../../fora" };
    expect(await storeMemberLogo(input())).toEqual({ ok: false });
    expect(h.dbWrites).toEqual([]);
    expect(h.destroys).toEqual([]);
  });
});

describe("removeStoredMemberLogo", () => {
  it("zera a URL e o public_id do logo e apaga o arquivo do próprio clube", async () => {
    await removeStoredMemberLogo({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: OLD_ID });
    expect(h.dbWrites).toEqual([expect.objectContaining({ logoUrl: null, logoPublicId: null })]);
    expect(h.dbWrites[0]).not.toHaveProperty("photoUrl");
    expect(h.destroys).toEqual([OLD_ID]);
  });

  it("sem logo guardado: só zera as colunas, sem chamar o Cloudinary", async () => {
    await removeStoredMemberLogo({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: null });
    expect(h.dbWrites).toHaveLength(1);
    expect(h.destroys).toEqual([]);
  });

  it("falha ao apagar no Cloudinary não impede a remoção no banco", async () => {
    h.destroyError = new Error("timeout");
    await expect(
      removeStoredMemberLogo({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: OLD_ID })
    ).resolves.toBeUndefined();
    expect(h.dbWrites).toHaveLength(1);
  });
});
