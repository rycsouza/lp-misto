import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/conta/foto: só o sócio logado, pelo e-mail da sessão; limite por conta; tamanho
 * máximo; o TIPO vem dos magic bytes (MIME declarado + assinatura do mesmo tipo); SVG, GIF e
 * HTML recusados; nada do Cloudinary vaza na resposta.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const ACCOUNT = { id: "acc-1", email: "socio@example.com", name: "Maria Souza" };
const OK_URL =
  "https://res.cloudinary.com/misto-test/image/upload/c_fill,g_face,w_512,h_512,q_auto,f_auto/clube-a/socios/fotos/novo1";

const h = vi.hoisted(() => ({
  session: null as unknown,
  sessionCalls: 0,
  member: null as unknown,
  memberLookups: [] as string[],
  limited: false,
  tenant: "clube-a" as string | null,
  store: vi.fn(),
}));

vi.mock("@/lib/accounts/session", () => ({
  getCustomerAccount: async () => {
    h.sessionCalls++;
    return h.session;
  },
}));
vi.mock("@/lib/membership/my-member", () => ({
  findMemberByAccountEmail: async (email: string) => {
    h.memberLookups.push(email);
    return h.member;
  },
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => h.tenant,
}));
vi.mock("@/lib/membership/member-photo-service", () => ({
  storeMemberPhoto: (...args: unknown[]) => h.store(...args),
}));

import { POST } from "./route";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const WEBP = [...ascii("RIFF"), 0x10, 0, 0, 0, ...ascii("WEBP")];

function fileForm(bytesArr: number[] | Uint8Array, type: string, name = "foto.bin", extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", new File([Uint8Array.from(bytesArr)], name, { type }));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

function post(form: FormData, headers: Record<string, string> = {}) {
  return new Request("https://clube-a.example/api/conta/foto", { method: "POST", body: form, headers });
}

async function call(form: FormData, headers: Record<string, string> = {}) {
  const res = await POST(post(form, headers));
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.session = ACCOUNT;
  h.sessionCalls = 0;
  h.member = { id: MEMBER_ID, name: "Maria S.", photoUrl: null, photoPublicId: null };
  h.memberLookups = [];
  h.limited = false;
  h.tenant = "clube-a";
  h.store.mockReset();
  h.store.mockResolvedValue({ ok: true, photoUrl: OK_URL });
});

describe("POST /api/conta/foto — autorização", () => {
  it("sem sessão: 401 e nada é lido nem gravado", async () => {
    h.session = null;
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r.status).toBe(401);
    expect(h.memberLookups).toEqual([]);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("logado mas sem sócio com o e-mail da conta: 403", async () => {
    h.member = null;
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r.status).toBe(403);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("o sócio é o do e-mail da sessão, e campos extras do formulário são ignorados", async () => {
    const r = await call(fileForm(JPEG, "image/jpeg", "foto.jpg", { memberId: "outro-socio", photoUrl: "https://evil.test/x" }));
    expect(r.status).toBe(200);
    expect(h.memberLookups).toEqual([ACCOUNT.email]);
    expect(h.store).toHaveBeenCalledTimes(1);
    expect(h.store.mock.calls[0][0]).toMatchObject({ memberId: MEMBER_ID, tenantSlug: "clube-a", type: "image/jpeg" });
  });

  it("envio de outro site (Origin diferente do host): 403 antes de olhar a sessão", async () => {
    const r = await call(fileForm(JPEG, "image/jpeg"), { host: "clube-a.example", origin: "https://evil.test" });
    expect(r.status).toBe(403);
    expect(h.sessionCalls).toBe(0);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("Origin igual ao host da requisição: aceito (o caso positivo prova que o host foi lido)", async () => {
    const r = await call(fileForm(JPEG, "image/jpeg"), { host: "clube-a.example", origin: "https://clube-a.example" });
    expect(r.status).toBe(200);
  });

  it("Origin malformado: 403", async () => {
    const r = await call(fileForm(JPEG, "image/jpeg"), { host: "clube-a.example", origin: "null" });
    expect(r.status).toBe(403);
  });
});

describe("POST /api/conta/foto — limites", () => {
  it("limite de envios por conta atingido: 429 e nada é gravado", async () => {
    h.limited = true;
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r.status).toBe(429);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("arquivo maior que 5 MB: 413 (sem chamar o armazenamento)", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPEG, 0);
    const r = await call(fileForm(big, "image/jpeg", "grande.jpg"));
    expect(r.status).toBe(413);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("corpo muito maior que o limite (lido com teto, mesmo sem Content-Length confiável): 413", async () => {
    const huge = new Uint8Array(6 * 1024 * 1024);
    huge.set(JPEG, 0);
    const r = await call(fileForm(huge, "image/jpeg"), { "content-length": "100" });
    expect(r.status).toBe(413);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("sem clube identificado (tenant): 500 genérico e nada gravado", async () => {
    h.tenant = null;
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r.status).toBe(500);
    expect(h.store).not.toHaveBeenCalled();
  });
});

describe("POST /api/conta/foto — tipo real do arquivo", () => {
  it("JPEG, PNG e WebP com assinatura do mesmo tipo: aceitos", async () => {
    expect((await call(fileForm(JPEG, "image/jpeg"))).status).toBe(200);
    expect((await call(fileForm(PNG, "image/png"))).status).toBe(200);
    expect((await call(fileForm(WEBP, "image/webp"))).status).toBe(200);
    expect(h.store.mock.calls.map((c) => c[0].type)).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("MIME declarado como JPEG mas bytes de PNG: 415", async () => {
    const r = await call(fileForm(PNG, "image/jpeg"));
    expect(r.status).toBe(415);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("MIME de imagem permitido com conteúdo HTML/SVG/GIF disfarçado: 415", async () => {
    expect((await call(fileForm(ascii("<svg xmlns='http://www.w3.org/2000/svg'><script>x</script></svg>"), "image/png"))).status).toBe(415);
    expect((await call(fileForm(ascii("<html><script>alert(1)</script>"), "image/jpeg"))).status).toBe(415);
    expect((await call(fileForm(ascii("GIF89a....."), "image/webp"))).status).toBe(415);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("MIME fora da allowlist (GIF, SVG) mesmo com assinatura válida: 415", async () => {
    expect((await call(fileForm(ascii("GIF89a....."), "image/gif"))).status).toBe(415);
    expect((await call(fileForm(JPEG, "image/svg+xml"))).status).toBe(415);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("campo 'file' que não é arquivo, ou arquivo vazio: 400", async () => {
    const texto = new FormData();
    texto.append("file", "não sou arquivo");
    expect((await call(texto)).status).toBe(400);
    expect((await call(fileForm([], "image/jpeg"))).status).toBe(400);
    expect((await call(new FormData())).status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("corpo que não é multipart: 400", async () => {
    const res = await POST(
      new Request("https://clube-a.example/api/conta/foto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });
});

describe("POST /api/conta/foto — resposta", () => {
  it("sucesso: { ok, photoUrl } com a URL já transformada, sem outros campos", async () => {
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r).toEqual({ status: 200, body: { ok: true, photoUrl: OK_URL } });
  });

  it("sucesso troca a foto anterior do próprio sócio (o public_id antigo vai para o armazenamento)", async () => {
    h.member = { id: MEMBER_ID, name: "Maria S.", photoUrl: "https://res.cloudinary.com/x", photoPublicId: "clube-a/socios/fotos/antiga" };
    await call(fileForm(JPEG, "image/jpeg"));
    expect(h.store.mock.calls[0][0]).toMatchObject({ memberId: MEMBER_ID, previousPublicId: "clube-a/socios/fotos/antiga" });
  });

  it("falha no armazenamento: 500 genérico, sem detalhe do Cloudinary", async () => {
    h.store.mockResolvedValue({ ok: false });
    const r = await call(fileForm(JPEG, "image/jpeg"));
    expect(r.status).toBe(500);
    expect(Object.keys(r.body).sort()).toEqual(["error", "ok"]);
    expect(JSON.stringify(r.body)).not.toMatch(/cloudinary|stack|secret|chave/i);
  });

  it("respostas de erro têm só { ok: false, error } e não são cacheadas", async () => {
    h.member = null;
    const res = await POST(post(fileForm(JPEG, "image/jpeg")));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(await res.json()).sort()).toEqual(["error", "ok"]);
  });
});
