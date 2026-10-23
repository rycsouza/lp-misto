import { describe, it, expect } from "vitest";
import { INVITE_PATH, inviteMessage, inviteUrl, inviteWhatsAppUrl } from "./invite";

describe("inviteUrl", () => {
  it("usa só a origem do site + página de adesão (sem caminho, query ou fragmento de origem)", () => {
    expect(inviteUrl("https://misto.com.br")).toBe("https://misto.com.br/socios/adesao");
    expect(inviteUrl("https://misto.com.br/conta?aba=socio#x")).toBe("https://misto.com.br/socios/adesao");
    expect(inviteUrl("http://localhost:3000")).toBe("http://localhost:3000/socios/adesao");
  });

  it("origem inválida ou de outro protocolo cai no caminho relativo", () => {
    expect(inviteUrl("")).toBe(INVITE_PATH);
    expect(inviteUrl("javascript:alert(1)")).toBe(INVITE_PATH);
    expect(inviteUrl("null")).toBe(INVITE_PATH);
  });

  it("o link não leva dado do sócio (nenhuma query)", () => {
    expect(new URL(inviteUrl("https://misto.com.br")).search).toBe("");
  });
});

describe("inviteMessage", () => {
  it("usa o nome do programa e do clube", () => {
    expect(inviteMessage("Sócio Carcará", "Misto Esporte Clube")).toBe(
      "Vem ser Sócio Carcará do Misto Esporte Clube também! Conheça os planos:",
    );
  });

  it("sem nome de programa válido, usa o padrão; sem clube, omite", () => {
    expect(inviteMessage(undefined, "")).toBe("Vem ser Sócio-Torcedor também! Conheça os planos:");
    expect(inviteMessage("<b>x</b>", null)).toBe("Vem ser Sócio-Torcedor também! Conheça os planos:");
  });
});

describe("inviteWhatsAppUrl", () => {
  it("abre o WhatsApp sem destinatário, com texto e link codificados", () => {
    const url = new URL(inviteWhatsAppUrl("Vem ser sócio & torcer!", "https://misto.com.br/socios/adesao"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBe("Vem ser sócio & torcer! https://misto.com.br/socios/adesao");
  });
});
