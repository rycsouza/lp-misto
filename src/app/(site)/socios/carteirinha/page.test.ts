import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Página do QR da carteirinha (src/app/(site)/socios/carteirinha/page.tsx).
 *
 * Regra: só a equipe com acesso ao validador vê dados do sócio. Qualquer outro
 * visitante recebe a MESMA página neutra (token válido, inválido ou ausente), e
 * esse caminho não consulta o banco.
 *
 * Como o teste não renderiza o DOM, a árvore de elementos é percorrida e os
 * componentes da própria página são executados para coletar o texto que sairia.
 */
const h = vi.hoisted(() => ({
  session: null as unknown,
  getView: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/app/actions/admin-auth", () => ({
  getAdminSession: async () => h.session,
}));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: "Clube Teste", primaryColor: "#123456", clubLogoUrl: null }),
}));
vi.mock("@/lib/base-url", () => ({
  getAppBaseUrl: async () => "https://clube.test",
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: async () => ({ ok: true, remaining: 1 }),
}));
vi.mock("@/lib/membership/sync", () => ({
  syncMemberById: (...args: unknown[]) => h.sync(...args),
}));
vi.mock("@/lib/membership/card", () => ({
  getMemberCardView: (...args: unknown[]) => h.getView(...args),
}));
vi.mock("@/lib/db/client", () => ({
  getDb: async () => {
    throw new Error("DB_NAO_DEVE_SER_CHAMADO_DIRETO");
  },
}));

import CarteirinhaPage from "./page";

const TOKEN = "11111111-2222-4333-8444-555555555555";
const ADMIN_CLUBE = { userId: "u-admin", email: "admin@clube.test", name: "Admin", role: "admin", permissions: {} };
const ADMIN_PLATAFORMA = {
  userId: "p-admin",
  email: "plataforma@sport55.test",
  name: "Plataforma",
  role: "admin",
  permissions: {},
  isPlatform: true,
};
const EDITOR_PORTARIA = { userId: "u-ed", email: "ed@clube.test", name: "Ed", role: "editor", permissions: { validacao: true } };
const EDITOR_SEM = { userId: "u-ed2", email: "ed2@clube.test", name: "Ed2", role: "editor", permissions: { jogos: true } };

function view(over: Record<string, unknown> = {}) {
  return {
    memberId: "m-1",
    name: "Ana Torcedora",
    planName: "Carcará",
    status: "active",
    memberSince: new Date("2026-03-01T12:00:00Z"),
    nextBillingDate: new Date("2026-11-10T12:00:00Z"),
    cancelledAt: null,
    ticketDiscountPct: 5,
    productDiscountPct: 10,
    freeTicketsPerHomeGame: 1,
    cardColor: "#1E3A8A",
    benefits: [],
    ...over,
  };
}

// Componentes definidos na própria página: são executados pelo teste.
// Os demais (Link, MemberCard, ...) só têm o props percorridos.
const PAGE_COMPONENTS = new Set(["PublicCarteirinha", "TeamCarteirinha", "PageLinks"]);

async function collectText(node: unknown, out: string[] = []): Promise<string[]> {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const n of node) await collectText(n, out);
    return out;
  }
  if (typeof node === "object" && "$$typeof" in node && "props" in node) {
    const el = node as unknown as { type: unknown; props: Record<string, unknown> };
    if (typeof el.type === "function" && PAGE_COMPONENTS.has((el.type as { name: string }).name)) {
      const rendered = await (el.type as (p: unknown) => unknown)(el.props);
      return collectText(rendered, out);
    }
    for (const v of Object.values(el.props ?? {})) await collectText(v, out);
    return out;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) await collectText(v, out);
  }
  return out;
}

async function render(token: string | undefined): Promise<string> {
  const tree = await CarteirinhaPage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) });
  return (await collectText(tree)).join("\n");
}

beforeEach(() => {
  h.session = null;
  h.getView.mockReset();
  h.getView.mockResolvedValue(view());
  h.sync.mockReset();
  h.sync.mockResolvedValue("updated");
});

describe("carteirinha: sem token", () => {
  it("redireciona para a área do sócio, sem consultar nada", async () => {
    await expect(CarteirinhaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/conta?aba=socio"
    );
    expect(h.getView).not.toHaveBeenCalled();
  });
});

describe("carteirinha: visitante comum (sem equipe)", () => {
  it("token válido: página neutra, sem nome, plano, situação, QR nem token", async () => {
    h.session = null;
    const text = await render(TOKEN);
    expect(text).toContain("Apresente esta carteirinha à equipe do clube.");
    expect(text).toContain("/conta?aba=socio");
    expect(text).not.toContain("Ana Torcedora");
    expect(text).not.toContain("Carcará");
    expect(text).not.toContain("SÓCIO");
    expect(text).not.toContain("ATIVO");
    expect(text).not.toContain(TOKEN);
    expect(h.getView).not.toHaveBeenCalled();
    expect(h.sync).not.toHaveBeenCalled();
  });

  it("token inexistente/inválido produz exatamente a mesma página (não revela se o token existe)", async () => {
    h.session = null;
    const valid = await render(TOKEN);
    h.getView.mockResolvedValue(null);
    const invalid = await render("nao-e-um-token");
    const notFound = await render("99999999-9999-4999-8999-999999999999");
    expect(invalid).toBe(valid);
    expect(notFound).toBe(valid);
    expect(h.getView).not.toHaveBeenCalled();
  });

  it("editor sem a permissão validacao também recebe a página neutra", async () => {
    h.session = EDITOR_SEM;
    const text = await render(TOKEN);
    expect(text).not.toContain("Ana Torcedora");
    expect(text).toContain("Apresente esta carteirinha à equipe do clube.");
    expect(h.getView).not.toHaveBeenCalled();
  });
});

describe("carteirinha: equipe com acesso ao validador", () => {
  it("admin do clube vê cartão, situação em destaque e orientação de documento", async () => {
    h.session = ADMIN_CLUBE;
    const text = await render(TOKEN);
    expect(h.getView).toHaveBeenCalledWith(TOKEN);
    expect(text).toContain("Ana Torcedora");
    expect(text).toContain("SÓCIO ATIVO");
    expect(text).toContain("Confira um documento com foto.");
  });

  it("admin da plataforma operando o clube também vê a verificação", async () => {
    h.session = ADMIN_PLATAFORMA;
    const text = await render(TOKEN);
    expect(text).toContain("SÓCIO ATIVO");
  });

  it("editor com permissão validacao vê a verificação", async () => {
    h.session = EDITOR_PORTARIA;
    const text = await render(TOKEN);
    expect(text).toContain("Ana Torcedora");
  });

  it("suspenso → SUSPENSO, sem o rótulo de ativo", async () => {
    h.session = ADMIN_CLUBE;
    h.getView.mockResolvedValue(view({ status: "suspended" }));
    const text = await render(TOKEN);
    expect(text).toContain("SUSPENSO");
    expect(text).not.toContain("SÓCIO ATIVO");
  });

  it("cancelado dentro do período pago → mostra até quando há benefício", async () => {
    h.session = ADMIN_CLUBE;
    h.getView.mockResolvedValue(view({ status: "cancelled" }));
    const text = await render(TOKEN);
    expect(text).toMatch(/BENEFÍCIOS ATÉ \d{2}\/\d{2}\/\d{4}/);
  });

  it("pendente → PENDENTE e reconsulta o gateway com o id do sócio", async () => {
    h.session = ADMIN_CLUBE;
    h.getView.mockResolvedValue(view({ status: "pending" }));
    const text = await render(TOKEN);
    expect(h.sync).toHaveBeenCalledWith("m-1");
    expect(text).toContain("PENDENTE");
  });

  it("token inexistente → 'Carteirinha inválida', sem dados de ninguém", async () => {
    h.session = ADMIN_CLUBE;
    h.getView.mockResolvedValue(null);
    const text = await render(TOKEN);
    expect(text).toContain("Carteirinha inválida");
    expect(text).not.toContain("Ana Torcedora");
  });
});
