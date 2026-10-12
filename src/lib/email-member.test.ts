import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * E-mail de boas-vindas do sócio: a carteirinha vive na área logada (o e-mail
 * não carrega mais o token secreto) e dados digitados pelo usuário nunca viram
 * HTML no e-mail.
 */
const h = vi.hoisted(() => ({ sent: [] as { to: string; html: string; subject: string }[], member: null as unknown }));

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
  getSiteConfig: async () => ({ siteName: "Clube Exemplo", primaryColor: "#c19a5a" }),
}));
vi.mock("@/lib/base-url", () => ({ getAppBaseUrl: async () => "https://clube.example" }));

import { sendMemberWelcomeEmail } from "./email";

beforeEach(() => {
  h.sent = [];
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
