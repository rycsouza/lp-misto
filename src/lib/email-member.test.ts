import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * E-mail de boas-vindas do sócio: a carteirinha vive na área logada (o e-mail
 * não carrega mais o token secreto) e dados digitados pelo usuário nunca viram
 * HTML no e-mail.
 */
const h = vi.hoisted(() => ({
  sent: [] as { to: string; html: string; subject: string }[],
  member: null as unknown,
  programName: undefined as string | undefined,
  siteName: "Clube Exemplo" as string,
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; html: string; subject: string }) => {
        h.sent.push(m);
      },
    }),
  },
}));
vi.mock("@/lib/db/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "leftJoin", "where"]) chain[m] = () => chain;
  chain.limit = async () => (h.member ? [h.member] : []);
  return { getDb: async () => chain };
});
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: h.siteName, primaryColor: "#c19a5a", membershipProgramName: h.programName }),
}));
vi.mock("@/lib/base-url", () => ({ getAppBaseUrl: async () => "https://clube.example" }));

import { sendMemberWelcomeEmail } from "./email";

beforeEach(() => {
  h.sent = [];
  h.programName = undefined;
  h.siteName = "Clube Exemplo";
  process.env.MAILTRAP_HOST = "smtp.test";
  process.env.MAILTRAP_USER = "u";
  process.env.MAILTRAP_PASS = "p";
  h.member = {
    id: "m1",
    name: "Titular Exemplo",
    email: "titular@example.com",
    memberCardToken: "5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f",
    planName: "Ouro",
    planPriceCents: 2990,
  };
});

describe("sendMemberWelcomeEmail", () => {
  it("leva à carteirinha na conta, sem o token secreto no e-mail", async () => {
    await sendMemberWelcomeEmail("m1");
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].html).toContain("https://clube.example/conta?aba=socio");
    expect(h.sent[0].html).not.toContain("5f0d1c9e-8a7b-4c3d-9e2f-1a2b3c4d5e6f");
  });

  it("nome do sócio é escapado (sem injeção de HTML/link no e-mail)", async () => {
    h.member = { ...(h.member as object), name: '<a href="https://phishing.example">Clique</a>' };
    await sendMemberWelcomeEmail("m1");
    expect(h.sent[0].html).not.toContain('<a href="https://phishing.example">');
    expect(h.sent[0].html).toContain("&lt;a href=&quot;https://phishing.example&quot;&gt;");
  });
});

describe("sendMemberWelcomeEmail: nome do programa de sócio", () => {
  it("sem nome configurado: cabeçalho e fallback do plano usam Sócio-Torcedor", async () => {
    h.member = { ...(h.member as object), planName: null };
    await sendMemberWelcomeEmail("m1");
    expect(h.sent[0].html).toContain(">Sócio-Torcedor</p>");
    expect(h.sent[0].html).toContain("<strong style=\"color:#e5e5e5;\">Sócio-Torcedor</strong> está ativa");
  });

  it("nome configurado aparece no cabeçalho e no fallback do plano", async () => {
    h.programName = "Sócio D'Ouro";
    h.member = { ...(h.member as object), planName: null };
    await sendMemberWelcomeEmail("m1");
    expect(h.sent[0].html).toContain(">Sócio D'Ouro</p>");
    expect(h.sent[0].html).toContain(">Sócio D'Ouro</strong> está ativa");
    expect(h.sent[0].html).not.toContain("Sócio-Torcedor");
  });

  it("nome do plano continua escapado; nome do programa inválido não vira HTML", async () => {
    h.programName = '<img src=x onerror="alert(1)">';
    h.member = { ...(h.member as object), planName: '<b onmouseover="x">Ouro</b>' };
    await sendMemberWelcomeEmail("m1");
    const html = h.sent[0].html;
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain("<b onmouseover");
    expect(html).toContain("&lt;b onmouseover=&quot;x&quot;&gt;Ouro&lt;/b&gt;");
    expect(html).toContain(">Sócio-Torcedor</p>");
  });
});

describe("e-mail de sócio: nome do clube (editável pelo admin do clube) é escapado", () => {
  it("nome do clube com HTML não vira marcação no cabeçalho nem no rodapé", async () => {
    h.siteName = '<a href="https://phishing.example">Clique</a>';
    await sendMemberWelcomeEmail("m1");
    const html = h.sent[0].html;
    expect(html).not.toContain('<a href="https://phishing.example">');
    expect(html).toContain("&lt;A HREF=&quot;HTTPS://PHISHING.EXAMPLE&quot;&gt;CLIQUE&lt;/A&gt;");
  });

  it("nome do clube com acento e & continua legível (escapado, não removido)", async () => {
    h.siteName = "Misto & Clube";
    await sendMemberWelcomeEmail("m1");
    expect(h.sent[0].html).toContain("MISTO &amp; CLUBE");
  });
});

