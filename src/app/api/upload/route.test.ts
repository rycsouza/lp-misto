import { describe, it, expect, beforeEach, vi } from "vitest";

/** Upload de imagem do painel: sessão, limite, pasta validada e prefixada pelo clube. */
const h = vi.hoisted(() => ({
  session: null as unknown,
  limited: false,
  uploads: [] as { folder: string }[],
}));

vi.mock("@/app/actions/admin-auth", () => ({ getAdminSession: async () => h.session }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: async () => ({ ok: !h.limited, remaining: 0 }) }));
vi.mock("@/lib/base-url", () => ({ getCurrentTenantSlug: async () => "clube-a" }));
vi.mock("cloudinary", () => ({
  v2: {
    config: () => {},
    uploader: {
      upload: async (_data: string, opts: { folder: string }) => {
        h.uploads.push({ folder: opts.folder });
        return { secure_url: "https://res.cloudinary.com/x/image/upload/v1/a.png" };
      },
    },
  },
}));

import { POST } from "./route";

function req(folder?: string) {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "a.png", { type: "image/png" }));
  if (folder !== undefined) fd.append("folder", folder);
  return new Request("https://clube.example/api/upload", { method: "POST", body: fd });
}

beforeEach(() => {
  h.session = { userId: "u1", role: "admin", permissions: {} };
  h.limited = false;
  h.uploads = [];
});

describe("POST /api/upload", () => {
  it("sem sessão → 401", async () => {
    h.session = null;
    expect((await POST(req("misto"))).status).toBe(401);
    expect(h.uploads).toEqual([]);
  });

  it("pasta do painel vai para a pasta do clube", async () => {
    expect((await POST(req("misto/loja/variantes"))).status).toBe(200);
    expect(h.uploads).toEqual([{ folder: "clube-a/misto/loja/variantes" }]);
  });

  it("sem pasta → padrão do clube", async () => {
    await POST(req());
    expect(h.uploads).toEqual([{ folder: "clube-a/misto" }]);
  });

  it("pasta maliciosa ou de outro clube é recusada", async () => {
    for (const f of ["../clube-b", "clube-b/../../x", "a/b/c/d", "Misto Teste", "a//b", "/abs"]) {
      expect((await POST(req(f))).status).toBe(400);
    }
    expect(h.uploads).toEqual([]);
  });

  it("limite de envios → 429", async () => {
    h.limited = true;
    expect((await POST(req("misto"))).status).toBe(429);
    expect(h.uploads).toEqual([]);
  });
});

describe("POST /api/upload — conteúdo real do arquivo", () => {
  it("arquivo com MIME de imagem mas conteúdo de outro tipo é recusado", async () => {
    const fd = new FormData();
    fd.append("file", new File([new TextEncoder().encode("<html><script>x</script>")], "a.png", { type: "image/png" }));
    fd.append("folder", "misto");
    const res = await POST(new Request("https://clube.example/api/upload", { method: "POST", body: fd }));
    expect(res.status).toBe(400);
    expect(h.uploads).toEqual([]);
  });
});
