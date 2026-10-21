import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Armazenamento da foto do sócio: sobe SÓ para a pasta do clube, já recortada; grava a URL
 * de entrega (com a transformação) e o public_id; apaga a foto anterior só se for deste
 * clube; não deixa asset órfão quando o banco falha; nunca devolve detalhe do Cloudinary.
 */
const h = vi.hoisted(() => ({
  uploads: [] as { data: string; opts: Record<string, unknown> }[],
  destroys: [] as string[],
  uploadResult: { public_id: "clube-a/socios/fotos/novo1" } as { public_id: string },
  uploadError: null as Error | null,
  destroyError: null as Error | null,
  dbWrites: [] as Record<string, unknown>[],
  dbError: null as Error | null,
  /** Quantas linhas o UPDATE condicional "acerta" (0 = a foto guardada mudou no meio). */
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

import { removeStoredMemberPhoto, storeMemberPhoto } from "./member-photo-service";
import { MEMBER_PHOTO_TRANSFORM } from "./member-photo";

const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const OLD_ID = "clube-a/socios/fotos/antiga1";
const NEW_URL = `https://res.cloudinary.com/misto-test/image/upload/${MEMBER_PHOTO_TRANSFORM}/clube-a/socios/fotos/novo1`;

function reset() {
  h.uploads = [];
  h.destroys = [];
  h.uploadResult = { public_id: "clube-a/socios/fotos/novo1" };
  h.uploadError = null;
  h.destroyError = null;
  h.dbWrites = [];
  h.dbError = null;
  h.dbRowsUpdated = 1;
}

beforeEach(() => {
  reset();
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "misto-test");
  vi.stubEnv("CLOUDINARY_API_KEY", "chave-de-teste");
  vi.stubEnv("CLOUDINARY_API_SECRET", "segredo-de-teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const input = (over: Partial<Parameters<typeof storeMemberPhoto>[0]> = {}) => ({
  memberId: MEMBER_ID,
  tenantSlug: "clube-a",
  bytes: PNG,
  type: "image/png" as const,
  previousPublicId: null as string | null,
  ...over,
});

describe("storeMemberPhoto", () => {
  it("sobe para <clube>/socios/fotos, como imagem, já recortada no upload", async () => {
    const r = await storeMemberPhoto(input());
    expect(r).toEqual({ ok: true, photoUrl: NEW_URL });
    expect(h.uploads).toHaveLength(1);
    const { data, opts } = h.uploads[0];
    expect(data.startsWith("data:image/png;base64,")).toBe(true);
    expect(opts).toMatchObject({
      folder: "clube-a/socios/fotos",
      resource_type: "image",
      type: "upload",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      // Parâmetros (objeto), NUNCA string: string vira "transformação nomeada" e o upload falha.
      transformation: [{ crop: "fill", gravity: "face", width: 512, height: 512, quality: "auto" }],
    });
  });

  it("grava a URL de entrega transformada e o public_id (nunca a URL de upload crua)", async () => {
    await storeMemberPhoto(input());
    expect(h.dbWrites).toHaveLength(1);
    expect(h.dbWrites[0]).toMatchObject({ photoUrl: NEW_URL, photoPublicId: "clube-a/socios/fotos/novo1" });
    expect(String(h.dbWrites[0].photoUrl)).toContain(`/image/upload/${MEMBER_PHOTO_TRANSFORM}/`);
  });

  it("sem foto anterior: não apaga nada", async () => {
    await storeMemberPhoto(input({ previousPublicId: null }));
    expect(h.destroys).toEqual([]);
  });

  it("troca: apaga a foto antiga (do mesmo clube) depois de gravar a nova", async () => {
    h.uploadResult = { public_id: "clube-a/socios/fotos/novo1" };
    await storeMemberPhoto(input({ previousPublicId: OLD_ID }));
    expect(h.destroys).toEqual([OLD_ID]);
  });

  it("não apaga um public_id de outro clube (dado corrompido ou adulterado)", async () => {
    await storeMemberPhoto(input({ previousPublicId: "clube-b/socios/fotos/antiga1" }));
    expect(h.destroys).toEqual([]);
  });

  it("falha no upload: recusa sem gravar e sem apagar a antiga", async () => {
    h.uploadError = new Error("cloudinary 500 com detalhe interno");
    const r = await storeMemberPhoto(input({ previousPublicId: OLD_ID }));
    expect(r).toEqual({ ok: false });
    expect(h.dbWrites).toEqual([]);
    expect(h.destroys).toEqual([]);
  });

  it("falha no banco: apaga a foto recém-enviada (sem órfã) e mantém a antiga", async () => {
    h.dbError = new Error("conexão perdida");
    const r = await storeMemberPhoto(input({ previousPublicId: OLD_ID }));
    expect(r).toEqual({ ok: false });
    expect(h.destroys).toEqual(["clube-a/socios/fotos/novo1"]);
  });

  it("envio concorrente: se a foto guardada mudou antes da gravação, recusa e apaga o PRÓPRIO upload", async () => {
    h.dbRowsUpdated = 0;
    const r = await storeMemberPhoto(input({ previousPublicId: OLD_ID }));
    expect(r).toEqual({ ok: false });
    expect(h.dbWrites).toEqual([]);
    expect(h.destroys).toEqual(["clube-a/socios/fotos/novo1"]);
    expect(h.destroys).not.toContain(OLD_ID);
  });

  it("erro não vaza detalhe: o resultado é só { ok: false }", async () => {
    h.uploadError = new Error("segredo=abc chave=xyz");
    const r = await storeMemberPhoto(input());
    expect(JSON.stringify(r)).toBe('{"ok":false}');
  });

  it("sem credenciais do Cloudinary: não sobe nada", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    const r = await storeMemberPhoto(input());
    expect(r).toEqual({ ok: false });
    expect(h.uploads).toEqual([]);
  });

  it("sem clube (tenant) válido: não sobe nada (nunca sai da pasta do clube)", async () => {
    expect(await storeMemberPhoto(input({ tenantSlug: null }))).toEqual({ ok: false });
    expect(await storeMemberPhoto(input({ tenantSlug: "!!!" }))).toEqual({ ok: false });
    expect(h.uploads).toEqual([]);
  });

  it("falha ao montar a URL de entrega (public_id fora do formato): apaga e recusa", async () => {
    h.uploadResult = { public_id: "../../fora" };
    const r = await storeMemberPhoto(input());
    expect(r).toEqual({ ok: false });
    expect(h.dbWrites).toEqual([]);
    expect(h.destroys).toEqual([]);
  });
});

describe("removeStoredMemberPhoto", () => {
  it("zera a URL e o public_id e apaga o arquivo do próprio clube", async () => {
    await removeStoredMemberPhoto({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: OLD_ID });
    expect(h.dbWrites).toEqual([expect.objectContaining({ photoUrl: null, photoPublicId: null })]);
    expect(h.destroys).toEqual([OLD_ID]);
  });

  it("sem foto guardada: só zera as colunas, sem chamar o Cloudinary", async () => {
    await removeStoredMemberPhoto({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: null });
    expect(h.dbWrites).toHaveLength(1);
    expect(h.destroys).toEqual([]);
  });

  it("falha ao apagar no Cloudinary não impede a remoção no banco", async () => {
    h.destroyError = new Error("timeout");
    await expect(
      removeStoredMemberPhoto({ memberId: MEMBER_ID, tenantSlug: "clube-a", previousPublicId: OLD_ID })
    ).resolves.toBeUndefined();
    expect(h.dbWrites).toHaveLength(1);
  });
});
