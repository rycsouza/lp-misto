import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * E-mails da área do cliente (criar senha, redefinir, criar conta). O link é
 * escapado no atributo href e o nome do cliente nunca vira HTML.
 */
const h = vi.hoisted(() => ({ sent: [] as { to: string; html: string; subject: string; text: string }[] }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; html: string; subject: string; text: string }) => {
        h.sent.push(m);
      },
    }),
  },
}));
vi.mock("@/lib/db/client", () => ({ getDb: async () => ({}) }));
vi.mock("@/lib/config", () => ({
  getSiteConfig: async () => ({ siteName: "Clube Exemplo", primaryColor: "#c19a5a" }),
}));
vi.mock("@/lib/base-url", () => ({ getAppBaseUrl: async () => "https://clube.example" }));

import {
  sendAccountVerifyEmail,
  sendAccountCreateEmail,
  sendAccountResetEmail,
  sendAccountExistsEmail,
} from "./email";

const URL_OK = "https://clube.example/conta/redefinir?t=abc.def.ghi&novo=1";

beforeEach(() => {
  h.sent = [];
  process.env.MAILTRAP_HOST = "smtp.test";
  process.env.MAILTRAP_USER = "u";
  process.env.MAILTRAP_PASS = "p";
});

describe("e-mails da conta", () => {
  it("criar senha: assunto e texto falam em LINK com validade de 48 horas, sem 'código'", async () => {
    await sendAccountVerifyEmail("dono@example.com", "Ana Souza", URL_OK);
    expect(h.sent[0].subject).toContain("Crie sua senha");
    expect(h.sent[0].html).toContain("Criar minha senha");
    expect(h.sent[0].html).toContain("48 horas");
    expect(h.sent[0].html).toContain("LINK");
    expect(h.sent[0].html).not.toMatch(/c[óo]digo/i);
  });

  it("'Crie sua conta' (esqueci a senha sem conta): texto oficial e botão para criar a senha", async () => {
    await sendAccountCreateEmail("dono@example.com", URL_OK);
    expect(h.sent[0].to).toBe("dono@example.com");
    expect(h.sent[0].subject).toContain("Crie sua conta");
    expect(h.sent[0].html).toContain(
      "Você pediu para redefinir a senha, mas ainda não tinha conta com este WhatsApp. Crie sua senha pelo botão abaixo."
    );
    expect(h.sent[0].html).toContain("Criar minha senha");
    expect(h.sent[0].html).toContain("48 horas");
  });

  it("redefinição e aviso de conta existente: link de 1 hora", async () => {
    await sendAccountResetEmail("dono@example.com", URL_OK);
    await sendAccountExistsEmail("dono@example.com", URL_OK);
    expect(h.sent).toHaveLength(2);
    for (const m of h.sent) {
      expect(m.html).toContain("1 hora");
      expect(m.html).toContain("Redefinir minha senha");
    }
  });

  it("nome digitado é escapado (sem HTML/link injetado no e-mail)", async () => {
    // Só o primeiro nome aparece no texto: sem espaço, o payload inteiro chega ao e-mail.
    await sendAccountVerifyEmail("dono@example.com", '"><svg/onload=alert(1)>', URL_OK);
    expect(h.sent[0].html).not.toContain("<svg");
    expect(h.sent[0].html).toContain("&quot;&gt;&lt;svg/onload=alert(1)&gt;");
  });

  it("link é escapado no atributo href (não sai do atributo)", async () => {
    const evil = 'https://clube.example/conta/redefinir?t=x"onmouseover="alert(1)&novo=1';
    await sendAccountCreateEmail("dono@example.com", evil);
    expect(h.sent[0].html).not.toContain('"onmouseover="alert(1)');
    expect(h.sent[0].html).toContain('href="https://clube.example/conta/redefinir?t=x&quot;onmouseover=&quot;alert(1)&amp;novo=1"');
  });
});
