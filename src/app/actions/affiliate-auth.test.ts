import { describe, it, expect, beforeEach, vi } from "vitest";

/** Link mágico do afiliado: HTML do e-mail escapado e envio com limite anti-spam. */
const h = vi.hoisted(() => ({
  affiliate: null as unknown,
  config: {} as Record<string, string>,
  limited: false,
  sent: [] as { html: string }[],
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async (m: { html: string }) => { h.sent.push(m); } }) },
}));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update", "set"]) chain[m] = () => chain;
  chain.limit = async () => (h.affiliate ? [h.affiliate] : []);
  chain.then = (r: (v: unknown) => void) => r([]);
  // A raiz não pode ser "thenable" (o await de getDb() a resolveria).
  return { getDb: async () => ({ select: () => chain, update: () => chain }) };
});
vi.mock("@/lib/config", () => ({ getSiteConfig: async () => h.config }));
vi.mock("@/lib/base-url", () => ({ getAppBaseUrl: async () => "https://clube.example" }));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: async () => "203.0.113.1",
  rateLimit: async () => ({ ok: !h.limited, remaining: 0 }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => {} }) }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

import { requestAffiliateLogin } from "./affiliate-auth";

function form(email: string) {
  const fd = new FormData();
  fd.append("email", email);
  return fd;
}

beforeEach(() => {
  process.env.MAILTRAP_HOST = "smtp.test";
  process.env.MAILTRAP_USER = "u";
  process.env.MAILTRAP_PASS = "p";
  h.affiliate = { id: "a1", name: "Ana", email: "ana@example.com", code: "ANA1", active: true };
  h.config = { siteName: "Clube", primaryColor: "#123456", clubLogoUrl: "https://cdn.example/logo.png" };
  h.limited = false;
  h.sent = [];
});

describe("requestAffiliateLogin", () => {
  it("nome do afiliado, nome do clube e logo vão escapados; cor/logo hostis são descartados", async () => {
    h.affiliate = { ...(h.affiliate as object), name: '<img src=x onerror=alert(1)>' };
    h.config = { siteName: 'Clube"><script>', primaryColor: "red;background:url(x)", clubLogoUrl: 'javascript:alert(1)' };
    await requestAffiliateLogin(form("ana@example.com"));
    const html = h.sent[0].html;
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("red;background");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("logo https válido é usado", async () => {
    await requestAffiliateLogin(form("ana@example.com"));
    expect(h.sent[0].html).toContain('src="https://cdn.example/logo.png"');
  });

  it("limite estourado → mesma resposta de sucesso e nenhum e-mail", async () => {
    h.limited = true;
    expect(await requestAffiliateLogin(form("ana@example.com"))).toEqual({ success: true });
    expect(h.sent).toEqual([]);
  });
});
