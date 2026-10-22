import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/conta/logo: só o sócio logado, pelo e-mail da sessão; SÓ plano empresarial ('pj', lido
 * do plano atual no servidor); limite por conta (contador compartilhado com a foto); tamanho máximo;
 * o TIPO vem dos magic bytes; SVG, GIF e HTML recusados; nada do Cloudinary vaza na resposta.
 */
const MEMBER_ID = "0b6f7a3e-3c1e-4f5a-9d2b-1a2b3c4d5e6f";
const ACCOUNT = { id: "acc-1", email: "empresa@example.com", name: "Padaria Bom Pão" };
const OK_URL =
  "https://res.cloudinary.com/misto-test/image/upload/c_pad,w_512,h_512,b_transparent,q_auto,f_auto/clube-a/socios/logos/novo1";

const h = vi.hoisted(() => ({
  session: null as unknown,
  sessionCalls: 0,
  member: null as unknown,
  memberLookups: [] as string[],
  limited: false,
  rateCalls: [] as string[],
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
  rateLimit: async (key: string) => {
    h.rateCalls.push(key);
    return { ok: !h.limited, remaining: 0 };
  },
}));
vi.mock("@/lib/base-url", () => ({
  getCurrentTenantSlug: async () => h.tenant,
}));
vi.mock("@/lib/membership/member-logo-service", () => ({
  storeMemberLogo: (...args: unknown[]) => h.store(...args),
}));

import { POST } from "./route";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const WEBP = [...ascii("RIFF"), 0x10, 0, 0, 0, ...ascii("WEBP")];

function fileForm(bytesArr: number[] | Uint8Array, type: string, name = "logo.bin", extra: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", new File([Uint8Array.from(bytesArr)], name, { type }));
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

function post(form: FormData, headers: Record<string, string> = {}) {
  return new Request("https://clube-a.example/api/conta/logo", { method: "POST", body: form, headers });
}

async function call(form: FormData, headers: Record<string, string> = {}) {
  const res = await POST(post(form, headers));
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

const PJ_MEMBER = { id: MEMBER_ID, name: "Padaria Bom Pão", photoUrl: null, photoPublicId: null, logoUrl: null, logoPublicId: null, planAudience: "pj" };
const PF_MEMBER = { ...PJ_MEMBER, planAudience: "pf" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.session = ACCOUNT;
  h.sessionCalls = 0;
  h.member = PJ_MEMBER;
  h.memberLookups = [];
  h.limited = false;
  h.rateCalls = [];
  h.tenant = "clube-a";
  h.store.mockReset();
  h.store.mockResolvedValue({ ok: true, logoUrl: OK_URL });
});

describe("POST /api/conta/logo — autorização", () => {
  it("sem sessão: 401 e nada é lido nem gravado", async () => {
    h.session = null;
    const r = await call(fileForm(PNG, "image/png"));
    expect(r.status).toBe(401);
    expect(h.memberLookups).toEqual([]);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("logado mas sem sócio com o e-mail da conta: 403", async () => {
    h.member = null;
    expect((await call(fileForm(PNG, "image/png"))).status).toBe(403);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("sócio de plano de CPF (pf): 403 'Logo é só para planos empresariais', sem gravar", async () => {
    h.member = PF_MEMBER;
    const r = await call(fileForm(PNG, "image/png"));
    expect(r).toEqual({ status: 403, body: { ok: false, error: "Logo é só para planos empresariais." } });
    expect(h.store).not.toHaveBeenCalled();
  });

  it("plano de CPF não vira empresarial por campo enviado pelo cliente", async () => {
    h.member = PF_MEMBER;
    const r = await call(fileForm(PNG, "image/png", "logo.png", { planAudience: "pj", audience: "pj", memberId: MEMBER_ID }));
    expect(r.status).toBe(403);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("sócio pj: o sócio é o do e-mail da sessão, e campos extras do formulário são ignorados", async () => {
    const r = await call(fileForm(PNG, "image/png", "logo.png", { memberId: "outro-socio", logoUrl: "https://evil.test/x" }));
    expect(r.status).toBe(200);
    expect(h.memberLookups).toEqual([ACCOUNT.email]);
    expect(h.store.mock.calls[0][0]).toMatchObject({ memberId: MEMBER_ID, tenantSlug: "clube-a", type: "image/png" });
  });

  it("envio de outro site (Origin diferente do host): 403 antes de olhar a sessão", async () => {
    const r = await call(fileForm(PNG, "image/png"), { host: "clube-a.example", origin: "https://evil.test" });
    expect(r.status).toBe(403);
    expect(h.sessionCalls).toBe(0);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("Origin igual ao host da requisição: aceito", async () => {
    const r = await call(fileForm(PNG, "image/png"), { host: "clube-a.example", origin: "https://clube-a.example" });
    expect(r.status).toBe(200);
  });
});

describe("POST /api/conta/logo — limites", () => {
  it("limite de envios por conta atingido: 429 e nada é gravado", async () => {
    h.limited = true;
    const r = await call(fileForm(PNG, "image/png"));
    expect(r.status).toBe(429);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("o limite é o da conta, compartilhado com a foto (mesma chave de contador)", async () => {
    await call(fileForm(PNG, "image/png"));
    expect(h.rateCalls).toEqual([`rl:conta-foto:${ACCOUNT.id}`]);
  });

  it("arquivo maior que 5 MB: 413 (sem chamar o armazenamento)", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG, 0);
    const r = await call(fileForm(big, "image/png", "grande.png"));
    expect(r.status).toBe(413);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("corpo muito maior que o limite (lido com teto, mesmo sem Content-Length confiável): 413", async () => {
    const huge = new Uint8Array(6 * 1024 * 1024);
    huge.set(PNG, 0);
    const r = await call(fileForm(huge, "image/png"), { "content-length": "100" });
    expect(r.status).toBe(413);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("sem clube identificado (tenant): 500 genérico e nada gravado", async () => {
    h.tenant = null;
    expect((await call(fileForm(PNG, "image/png"))).status).toBe(500);
    expect(h.store).not.toHaveBeenCalled();
  });
});

describe("POST /api/conta/logo — tipo real do arquivo", () => {
  it("JPEG, PNG e WebP com assinatura do mesmo tipo: aceitos (sem forçar JPEG)", async () => {
    expect((await call(fileForm(JPEG, "image/jpeg"))).status).toBe(200);
    expect((await call(fileForm(PNG, "image/png"))).status).toBe(200);
    expect((await call(fileForm(WEBP, "image/webp"))).status).toBe(200);
    expect(h.store.mock.calls.map((c) => c[0].type)).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("MIME declarado como JPEG mas bytes de PNG: 415", async () => {
    expect((await call(fileForm(PNG, "image/jpeg"))).status).toBe(415);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("MIME de imagem permitido com conteúdo SVG/HTML/GIF disfarçado: 415", async () => {
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

  it("campo 'file' que não é arquivo, ou arquivo vazio, ou sem arquivo: 400", async () => {
    const texto = new FormData();
    texto.append("file", "não sou arquivo");
    expect((await call(texto)).status).toBe(400);
    expect((await call(fileForm([], "image/png"))).status).toBe(400);
    expect((await call(new FormData())).status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });

  it("corpo que não é multipart: 400", async () => {
    const res = await POST(
      new Request("https://clube-a.example/api/conta/logo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
    expect(h.store).not.toHaveBeenCalled();
  });
});

describe("POST /api/conta/logo — resposta", () => {
  it("sucesso: { ok, logoUrl } com a URL de entrega do logo, sem outros campos", async () => {
    const r = await call(fileForm(PNG, "image/png"));
    expect(r).toEqual({ status: 200, body: { ok: true, logoUrl: OK_URL } });
  });

  it("troca o logo anterior do próprio sócio (o public_id antigo vai para o armazenamento)", async () => {
    h.member = { ...PJ_MEMBER, logoUrl: OK_URL, logoPublicId: "clube-a/socios/logos/antiga" };
    await call(fileForm(PNG, "image/png"));
    expect(h.store.mock.calls[0][0]).toMatchObject({ memberId: MEMBER_ID, previousPublicId: "clube-a/socios/logos/antiga" });
  });

  it("falha no armazenamento: 500 genérico, sem detalhe do Cloudinary", async () => {
    h.store.mockResolvedValue({ ok: false });
    const r = await call(fileForm(PNG, "image/png"));
    expect(r.status).toBe(500);
    expect(Object.keys(r.body).sort()).toEqual(["error", "ok"]);
    expect(JSON.stringify(r.body)).not.toMatch(/cloudinary|stack|secret|chave/i);
  });

  it("respostas de erro têm só { ok: false, error } e não são cacheadas", async () => {
    h.member = null;
    const res = await POST(post(fileForm(PNG, "image/png")));
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(Object.keys(await res.json()).sort()).toEqual(["error", "ok"]);
  });
});
